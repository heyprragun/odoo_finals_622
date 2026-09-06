import { Prisma, RecommendationStatus, RecommendationType, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { generateRecommendations as callGroq } from "./groq.service";

interface AuthenticatedUser {
  id: string;
  role: Role;
}

const RECOMMENDATION_INCLUDE = {
  product: true,
} satisfies Prisma.QuoteRecommendationInclude;

type RecommendationRow = Prisma.QuoteRecommendationGetPayload<{ include: typeof RECOMMENDATION_INCLUDE }>;

// Only ADMIN sees product cost/margin data, matching sanitizeProduct.ts's
// exact rule - a Sales Rep viewing their own quote's recommendations still
// never sees cost, only price/revenue (which need no cost to compute).
function formatRecommendation(row: RecommendationRow, viewerRole: Role) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    reason: row.reason,
    product: {
      id: row.product.id,
      name: row.product.name,
      sku: row.product.sku,
      category: row.product.category,
      unitPrice: Number(row.product.unitPrice),
      ...(viewerRole === Role.ADMIN ? { cost: Number(row.product.cost) } : {}),
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Layer 2 (resource ownership): only the owning Sales Rep - or Admin, as
// oversight - may generate/view/send recommendations for a quote, mirroring
// the ownership check quote.service.ts already applies everywhere else.
async function assertOwnsQuote(quoteId: string, user: AuthenticatedUser) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: { include: { product: true } } },
  });
  if (!quote) {
    throw ApiError.notFound("Quote not found");
  }
  if (quote.salesRepId !== user.id && user.role !== Role.ADMIN) {
    throw ApiError.forbidden("You can only manage recommendations for your own quotes");
  }
  return quote;
}

export async function listRecommendations(quoteId: string, user: AuthenticatedUser) {
  await assertOwnsQuote(quoteId, user);
  const rows = await prisma.quoteRecommendation.findMany({
    where: { quoteId },
    include: RECOMMENDATION_INCLUDE,
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => formatRecommendation(row, user.role));
}

/**
 * Calls Groq for fresh upsell/cross-sell ideas, grounded in the real active
 * catalog - the model is given only real SKUs and told never to invent one,
 * but its output is never trusted blindly: every returned sku is re-matched
 * against the catalog fetched here, and anything that doesn't match (or
 * duplicates a product already on the quote) is silently discarded before
 * a single row is written.
 */
export async function generateRecommendationsForQuote(quoteId: string, user: AuthenticatedUser) {
  const quote = await assertOwnsQuote(quoteId, user);
  if (quote.items.length === 0) {
    throw ApiError.badRequest("Add at least one product to the quote before generating recommendations");
  }

  const catalog = await prisma.product.findMany({ where: { active: true } });
  const catalogEntries = catalog.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    unitPrice: Number(p.unitPrice),
  }));
  const quoteSkus = new Set(quote.items.map((item) => item.product.sku));
  const quoteItemEntries = quote.items.map((item) => ({
    sku: item.product.sku,
    name: item.product.name,
    category: item.product.category,
    quantity: item.quantity,
  }));

  // Products already recommended and acted on (sent/accepted/declined)
  // shouldn't be re-suggested as a fresh SUGGESTED row on regenerate - only
  // still-pending SUGGESTED rows get replaced.
  const alreadyRecommended = await prisma.quoteRecommendation.findMany({
    where: { quoteId, status: { not: RecommendationStatus.SUGGESTED } },
    select: { productId: true },
  });
  const excludedProductIds = new Set(alreadyRecommended.map((r) => r.productId));

  const result = await callGroq(catalogEntries, quoteItemEntries);
  const catalogBySku = new Map(catalog.map((p) => [p.sku, p]));

  function resolveValid(suggestions: { sku: string; reason: string }[]) {
    const seen = new Set<string>();
    const resolved: { productId: string; reason: string }[] = [];
    for (const suggestion of suggestions) {
      const product = catalogBySku.get(suggestion.sku);
      if (!product) continue; // hallucinated sku - discard
      if (quoteSkus.has(suggestion.sku)) continue; // already on the quote
      if (excludedProductIds.has(product.id)) continue; // already sent/actioned
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      resolved.push({ productId: product.id, reason: suggestion.reason });
    }
    return resolved.slice(0, 3);
  }

  const upsellResolved = resolveValid(result.upsell);
  const crossSellResolved = resolveValid(result.crossSell);

  if (upsellResolved.length === 0 && crossSellResolved.length === 0) {
    throw new ApiError(502, "The AI service didn't return any valid suggestions from your catalog - try again");
  }

  await prisma.$transaction(async (tx) => {
    // Regenerating replaces prior suggestions still awaiting Rep review -
    // rows already sent to the customer are left untouched.
    await tx.quoteRecommendation.deleteMany({
      where: { quoteId, status: RecommendationStatus.SUGGESTED },
    });

    await tx.quoteRecommendation.createMany({
      data: [
        ...upsellResolved.map((r) => ({
          quoteId,
          productId: r.productId,
          type: RecommendationType.UPSELL,
          reason: r.reason,
        })),
        ...crossSellResolved.map((r) => ({
          quoteId,
          productId: r.productId,
          type: RecommendationType.CROSS_SELL,
          reason: r.reason,
        })),
      ],
    });
  });

  return listRecommendations(quoteId, user);
}

export async function sendRecommendationToCustomer(
  quoteId: string,
  recommendationId: string,
  user: AuthenticatedUser
) {
  await assertOwnsQuote(quoteId, user);

  const recommendation = await prisma.quoteRecommendation.findUnique({
    where: { id: recommendationId },
  });
  if (!recommendation || recommendation.quoteId !== quoteId) {
    throw ApiError.notFound("Recommendation not found");
  }

  const result = await prisma.quoteRecommendation.updateMany({
    where: { id: recommendationId, status: RecommendationStatus.SUGGESTED },
    data: { status: RecommendationStatus.SENT_TO_CUSTOMER },
  });
  if (result.count === 0) {
    throw ApiError.conflict("This recommendation has already been sent, or just changed - please refresh");
  }

  return listRecommendations(quoteId, user);
}
