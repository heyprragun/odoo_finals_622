import { CustomerRequestStatus, Prisma, QuoteAuditAction, QuoteStatus, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { assessDiscountRisk, getDiscountGovernanceContext } from "./discountGovernance.service";
import type { CreateQuoteInput, QuoteItemInput, UpdateQuoteInput } from "../validation/quote.validation";

// A quote is editable/re-submittable by its Sales Rep only while it's a
// draft or has just been kicked back for revision by an approver.
const EDITABLE_STATUSES: QuoteStatus[] = [QuoteStatus.DRAFT, QuoteStatus.REVISION_REQUIRED];

interface AuthenticatedUser {
  id: string;
  role: Role;
}

const QUOTE_INCLUDE = {
  customer: true,
  items: { include: { product: true } },
} satisfies Prisma.QuoteInclude;

interface ResolvedLineItem {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
}

/**
 * Looks up each requested product and snapshots its CURRENT selling price.
 * This snapshot (QuoteItem.unitPrice) is what gets persisted - later changes
 * to Product.unitPrice must never retroactively affect an existing quote.
 */
async function resolveLineItems(
  tx: Prisma.TransactionClient,
  requestedItems: { productId: string; quantity: number }[]
): Promise<ResolvedLineItem[]> {
  if (requestedItems.length === 0) return [];

  const productIds = [...new Set(requestedItems.map((item) => item.productId))];
  const products = await tx.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((product) => [product.id, product]));

  return requestedItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || !product.active) {
      throw ApiError.badRequest(`Product not found or inactive: ${item.productId}`);
    }
    return {
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.unitPrice,
    };
  });
}

function toQuoteItemsCreateData(items: ResolvedLineItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.unitPrice.mul(item.quantity),
  }));
}

/**
 * Backend-authoritative totals. Never trust subtotal/discount/tax/total
 * values sent by the client - only the raw percentages are accepted as
 * input, and even those are always re-applied to a freshly computed
 * subtotal here.
 *
 * subtotal = sum(quantity * unitPrice)
 * discountAmount = subtotal * discountPercentage / 100
 * taxableAmount = subtotal - discountAmount
 * taxAmount = taxableAmount * taxPercentage / 100
 * totalAmount = taxableAmount + taxAmount
 */
export function calculateTotals(
  items: { unitPrice: Prisma.Decimal; quantity: number }[],
  discountPercentage: Prisma.Decimal,
  taxPercentage: Prisma.Decimal
) {
  const subtotal = items.reduce(
    (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0)
  );
  const discountAmount = subtotal.mul(discountPercentage).div(100);
  const taxableAmount = subtotal.sub(discountAmount);
  const taxAmount = taxableAmount.mul(taxPercentage).div(100);
  const totalAmount = taxableAmount.add(taxAmount);
  return { subtotal, discountPercentage, taxPercentage, discountAmount, taxAmount, totalAmount };
}

async function generateQuoteNumber(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.quote.count();
  return `QT-${String(count + 1).padStart(5, "0")}`;
}

// SALES_REP sees only their own quotes; MANAGER sees every quote (read-only
// oversight - "same screen" as the Sales Rep's Quotations page).
export async function listQuotes(user: AuthenticatedUser) {
  const where: Prisma.QuoteWhereInput = user.role === Role.SALES_REP ? { salesRepId: user.id } : {};
  return prisma.quote.findMany({
    where,
    include: QUOTE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuoteForUser(quoteId: string, user: AuthenticatedUser) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: QUOTE_INCLUDE });
  if (!quote) {
    throw ApiError.notFound("Quote not found");
  }
  if (user.role === Role.SALES_REP && quote.salesRepId !== user.id) {
    throw ApiError.forbidden("You can only view your own quotes");
  }
  return quote;
}

export async function createQuote(input: CreateQuoteInput, salesRepId: string) {
  return prisma.$transaction(async (tx) => {
    let customerId = input.customerId;
    let requestItems: { productId: string; quantity: number }[] = [];
    let customerRequest: { id: string; customerId: string } | null = null;

    if (input.customerRequestId) {
      const request = await tx.customerRequest.findUnique({
        where: { id: input.customerRequestId },
        include: { items: true, quote: true },
      });
      if (!request) {
        throw ApiError.badRequest("Customer request not found");
      }

      // A request converts into at most one quotation. If one already
      // exists (draft or submitted), return it instead of creating a
      // duplicate - this also covers the CONVERTED case, since a converted
      // request always has a linked quote by construction.
      if (request.quote) {
        const existingQuote = await tx.quote.findUnique({
          where: { id: request.quote.id },
          include: QUOTE_INCLUDE,
        });
        return { quote: existingQuote!, created: false };
      }

      if (request.status === CustomerRequestStatus.CANCELLED) {
        throw ApiError.badRequest("Cannot create a quote from a cancelled request");
      }

      customerRequest = request;
      customerId = request.customerId;
      requestItems = request.items.map((item) => ({
        productId: item.productId,
        quantity: item.requestedQuantity,
      }));
    }

    if (!customerId) {
      throw ApiError.badRequest("customerId is required");
    }

    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw ApiError.badRequest("Customer not found");
    }

    const sourceItems: QuoteItemInput[] =
      input.items && input.items.length > 0 ? input.items : requestItems;
    const resolvedItems = await resolveLineItems(tx, sourceItems);
    const discountPercentage = new Prisma.Decimal(input.discountPercentage ?? 0);
    const taxPercentage = new Prisma.Decimal(input.taxPercentage ?? 0);
    const totals = calculateTotals(resolvedItems, discountPercentage, taxPercentage);
    const quoteNumber = await generateQuoteNumber(tx);

    const quote = await tx.quote.create({
      data: {
        quoteNumber,
        customerId,
        salesRepId,
        customerRequestId: customerRequest?.id,
        notes: input.notes,
        ...totals,
        items: { create: toQuoteItemsCreateData(resolvedItems) },
      },
      include: QUOTE_INCLUDE,
    });

    if (customerRequest) {
      await tx.customerRequest.update({
        where: { id: customerRequest.id },
        data: { status: CustomerRequestStatus.QUOTED },
      });
    }

    return { quote, created: true };
  });
}

export async function updateQuote(
  quoteId: string,
  input: UpdateQuoteInput,
  user: AuthenticatedUser
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!existing) {
      throw ApiError.notFound("Quote not found");
    }
    if (existing.salesRepId !== user.id) {
      throw ApiError.forbidden("You can only edit your own quotes");
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw ApiError.badRequest("Only draft or revision-required quotes can be edited");
    }

    const resolvedItems = await resolveLineItems(tx, input.items);
    const discountPercentage = new Prisma.Decimal(
      input.discountPercentage ?? existing.discountPercentage
    );
    const taxPercentage = new Prisma.Decimal(input.taxPercentage ?? existing.taxPercentage);
    const totals = calculateTotals(resolvedItems, discountPercentage, taxPercentage);

    await tx.quoteItem.deleteMany({ where: { quoteId } });

    return tx.quote.update({
      where: { id: quoteId },
      data: {
        notes: input.notes,
        ...totals,
        items: { create: toQuoteItemsCreateData(resolvedItems) },
      },
      include: QUOTE_INCLUDE,
    });
  });
}

export async function submitQuote(quoteId: string, user: AuthenticatedUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { items: { include: { product: true } }, customer: true },
    });
    if (!existing) {
      throw ApiError.notFound("Quote not found");
    }
    if (existing.salesRepId !== user.id) {
      throw ApiError.forbidden("You can only submit your own quotes");
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw ApiError.badRequest("Only draft or revision-required quotes can be submitted");
    }
    if (existing.items.length === 0) {
      throw ApiError.badRequest("Cannot submit a quote with no items");
    }

    const totals = calculateTotals(
      existing.items.map((item) => ({ unitPrice: item.unitPrice, quantity: item.quantity })),
      existing.discountPercentage,
      existing.taxPercentage
    );

    // Discount-governance risk engine decides risk level, but every quote -
    // regardless of risk - goes to the Sales Manager first. Finance only
    // gets involved for HIGH risk, once the Manager has signed off (see
    // approval.service.ts's approve transition), and every path still ends
    // at Admin since no quote is confirmed without Admin's master sign-off.
    const governanceContext = await getDiscountGovernanceContext(tx, existing.customer.tier);
    const { riskLevel } = assessDiscountRisk(existing.items, totals.discountPercentage, governanceContext);

    const nextStatus = QuoteStatus.PENDING_MANAGER_APPROVAL;

    const isResubmission = existing.status === QuoteStatus.REVISION_REQUIRED;

    const quote = await tx.quote.update({
      where: { id: quoteId },
      data: { status: nextStatus, riskLevel, ...totals },
      include: QUOTE_INCLUDE,
    });

    await tx.quoteAuditEntry.create({
      data: {
        quoteId,
        userId: user.id,
        action: isResubmission ? QuoteAuditAction.RESUBMITTED : QuoteAuditAction.SUBMITTED,
        note: `Applied ${totals.discountPercentage}% discount, ${totals.taxPercentage}% tax`,
      },
    });

    // Customer-request → quotation lifecycle: submitting the quote is what
    // takes the originating request out of the active queue for good.
    if (existing.customerRequestId) {
      await tx.customerRequest.update({
        where: { id: existing.customerRequestId },
        data: { status: CustomerRequestStatus.CONVERTED },
      });
    }

    return quote;
  });
}

/**
 * A pre-submission bail-out: the Sales Rep found the requested quantity
 * exceeds available inventory and is telling the customer up front that the
 * order can't be fulfilled as quoted. Reuses the REJECTED status - this
 * quote then surfaces via the customer's Negotiations tab exactly like an
 * approver's rejection would (with this note as the rejection reason),
 * letting the customer negotiate down the quantity through the same
 * existing flow rather than needing a separate mechanism.
 */
export async function markStockUnavailable(quoteId: string, user: AuthenticatedUser, note: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!existing) {
      throw ApiError.notFound("Quote not found");
    }
    if (existing.salesRepId !== user.id) {
      throw ApiError.forbidden("You can only manage your own quotes");
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw ApiError.badRequest("Only draft or revision-required quotes can be marked as not possible");
    }

    const result = await tx.quote.updateMany({
      where: { id: quoteId, status: existing.status },
      data: { status: QuoteStatus.REJECTED },
    });
    if (result.count === 0) {
      throw ApiError.conflict("This quote just changed - please refresh and try again");
    }

    await tx.quoteAuditEntry.create({
      data: { quoteId, userId: user.id, action: QuoteAuditAction.STOCK_UNAVAILABLE, note },
    });

    return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: QUOTE_INCLUDE });
  });
}
