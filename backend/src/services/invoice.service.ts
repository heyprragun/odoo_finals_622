import { InvoiceStatus, Prisma, ProductCategory } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";

async function generateInvoiceNumber(client: Prisma.TransactionClient): Promise<string> {
  const count = await client.invoice.count();
  return `INV-${String(count + 1).padStart(5, "0")}`;
}

/**
 * Called once a quote reaches APPROVED - from the auto-approve path in
 * quote.service.ts (LOW risk), the Manager's approve when risk isn't HIGH,
 * or Finance's final approval (HIGH risk). Creates:
 *  - one one-time invoice covering the quote's non-subscription line items
 *    (if any), due in 30 days;
 *  - one recurring invoice per subscription-category line item, for that
 *    subscription's first billing cycle (due on its nextBillingDate).
 * Call this AFTER createSubscriptionsForApprovedQuote in the same
 * transaction, since it looks up subscriptions by quoteId. Idempotent - safe
 * to call more than once for the same quote, and reused by the seed script
 * to backfill invoices for quotes that were approved before this existed.
 */
export async function createInvoicesForApprovedQuote(
  client: Prisma.TransactionClient,
  quoteId: string
) {
  const quote = await client.quote.findUnique({
    where: { id: quoteId },
    include: { items: { include: { product: true } } },
  });
  if (!quote) return;

  const oneTimeItems = quote.items.filter(
    (item) => item.product.category !== ProductCategory.SUBSCRIPTION
  );
  const oneTimeAmount = oneTimeItems.reduce(
    (sum, item) => sum.add(item.lineTotal),
    new Prisma.Decimal(0)
  );

  if (oneTimeAmount.greaterThan(0)) {
    const existing = await client.invoice.findFirst({
      where: { quoteId: quote.id, subscriptionId: null },
    });
    if (!existing) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await client.invoice.create({
        data: {
          invoiceNumber: await generateInvoiceNumber(client),
          customerId: quote.customerId,
          quoteId: quote.id,
          amount: oneTimeAmount,
          dueDate,
        },
      });
    }
  }

  const subscriptions = await client.subscription.findMany({ where: { quoteId: quote.id } });
  for (const sub of subscriptions) {
    const existing = await client.invoice.findFirst({ where: { subscriptionId: sub.id } });
    if (existing) continue;
    await client.invoice.create({
      data: {
        invoiceNumber: await generateInvoiceNumber(client),
        customerId: quote.customerId,
        quoteId: quote.id,
        subscriptionId: sub.id,
        amount: sub.unitPrice.mul(sub.quantity),
        dueDate: sub.nextBillingDate,
      },
    });
  }
}

const LIST_INCLUDE = { customer: true } satisfies Prisma.InvoiceInclude;
type InvoiceListRow = Prisma.InvoiceGetPayload<{ include: typeof LIST_INCLUDE }>;

function formatListItem(invoice: InvoiceListRow) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customer: { id: invoice.customer.id, name: invoice.customer.name, tier: invoice.customer.tier },
    amount: Number(invoice.amount),
    status: invoice.status,
    issuedDate: invoice.issuedDate,
    dueDate: invoice.dueDate,
  };
}

export async function listInvoices() {
  const invoices = await prisma.invoice.findMany({
    include: LIST_INCLUDE,
    orderBy: { issuedDate: "desc" },
  });

  const summary = {
    paid: invoices.filter((i) => i.status === InvoiceStatus.PAID).length,
    unpaid: invoices.filter((i) => i.status === InvoiceStatus.UNPAID).length,
  };

  return { summary, items: invoices.map(formatListItem) };
}

export async function getInvoiceDetail(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      quote: { include: { items: { include: { product: true } } } },
      subscription: { include: { product: true } },
    },
  });
  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }

  return {
    ...formatListItem(invoice),
    paidAt: invoice.paidAt,
    quote: invoice.quote
      ? {
          id: invoice.quote.id,
          quoteNumber: invoice.quote.quoteNumber,
          orderDate: invoice.quote.createdAt,
          items: invoice.quote.items.map((item) => ({
            productName: item.product.name,
            sku: item.product.sku,
            category: item.product.category,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
          })),
        }
      : null,
    subscription: invoice.subscription
      ? {
          id: invoice.subscription.id,
          productName: invoice.subscription.product.name,
          billingCycle: invoice.subscription.billingCycle,
          quantity: invoice.subscription.quantity,
          status: invoice.subscription.status,
          nextBillingDate: invoice.subscription.nextBillingDate,
        }
      : null,
  };
}

export async function markInvoiceAsPaid(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }
  if (invoice.status === InvoiceStatus.PAID) {
    throw ApiError.badRequest("This invoice is already marked as paid");
  }

  const result = await prisma.invoice.updateMany({
    where: { id: invoiceId, status: InvoiceStatus.UNPAID },
    data: { status: InvoiceStatus.PAID, paidAt: new Date() },
  });
  if (result.count === 0) {
    throw ApiError.conflict("This invoice's status just changed - please refresh and try again");
  }

  return getInvoiceDetail(invoiceId);
}
