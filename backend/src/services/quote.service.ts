import { CustomerRequestStatus, Prisma, QuoteStatus, type Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import type { CreateQuoteInput, QuoteItemInput, UpdateQuoteInput } from "../validation/quote.validation";

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

// Backend-authoritative totals. Never trust subtotal/total values sent by the client.
function calculateTotals(items: { unitPrice: Prisma.Decimal; quantity: number }[]) {
  const subtotal = items.reduce(
    (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0)
  );
  // Discount/tax governance is a later phase - always zero for now.
  const discountAmount = new Prisma.Decimal(0);
  const taxAmount = new Prisma.Decimal(0);
  const totalAmount = subtotal.sub(discountAmount).add(taxAmount);
  return { subtotal, discountAmount, taxAmount, totalAmount };
}

async function generateQuoteNumber(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.quote.count();
  return `QT-${String(count + 1).padStart(5, "0")}`;
}

export async function listQuotesForSalesRep(salesRepId: string) {
  return prisma.quote.findMany({
    where: { salesRepId },
    include: QUOTE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuoteForSalesRep(quoteId: string, user: AuthenticatedUser) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: QUOTE_INCLUDE });
  if (!quote) {
    throw ApiError.notFound("Quote not found");
  }
  if (quote.salesRepId !== user.id) {
    throw ApiError.forbidden("You can only view your own quotes");
  }
  return quote;
}

export async function createQuote(input: CreateQuoteInput, salesRepId: string) {
  return prisma.$transaction(async (tx) => {
    let customerId = input.customerId;
    let requestItems: { productId: string; quantity: number }[] = [];
    let customerRequest: { id: string; customerId: string; status: CustomerRequestStatus } | null =
      null;

    if (input.customerRequestId) {
      const request = await tx.customerRequest.findUnique({
        where: { id: input.customerRequestId },
        include: { items: true },
      });
      if (!request) {
        throw ApiError.badRequest("Customer request not found");
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
    const totals = calculateTotals(resolvedItems);
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

    if (customerRequest && customerRequest.status !== CustomerRequestStatus.QUOTED) {
      await tx.customerRequest.update({
        where: { id: customerRequest.id },
        data: { status: CustomerRequestStatus.QUOTED },
      });
    }

    return quote;
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
    if (existing.status !== QuoteStatus.DRAFT) {
      throw ApiError.badRequest("Only draft quotes can be edited");
    }

    const resolvedItems = await resolveLineItems(tx, input.items);
    const totals = calculateTotals(resolvedItems);

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
      include: { items: true },
    });
    if (!existing) {
      throw ApiError.notFound("Quote not found");
    }
    if (existing.salesRepId !== user.id) {
      throw ApiError.forbidden("You can only submit your own quotes");
    }
    if (existing.status !== QuoteStatus.DRAFT) {
      throw ApiError.badRequest("Only draft quotes can be submitted");
    }
    if (existing.items.length === 0) {
      throw ApiError.badRequest("Cannot submit a quote with no items");
    }

    const totals = calculateTotals(
      existing.items.map((item) => ({ unitPrice: item.unitPrice, quantity: item.quantity }))
    );

    return tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.SUBMITTED, ...totals },
      include: QUOTE_INCLUDE,
    });
  });
}
