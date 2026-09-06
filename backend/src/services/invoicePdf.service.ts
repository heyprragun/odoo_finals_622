import PDFDocument from "pdfkit";

// Same shape getInvoiceDetail (invoice.service.ts) already returns - kept as
// a structural type here rather than importing it, so this module has no
// dependency on Prisma/service internals, only the plain data it needs.
export interface InvoicePdfInput {
  invoiceNumber: string;
  customer: { name: string; tier: string };
  status: string;
  issuedDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  amount: number;
  quote: {
    quoteNumber: string;
    orderDate: Date;
    items: { productName: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }[];
  } | null;
  subscription: {
    productName: string;
    billingCycle: string;
    quantity: number;
    nextBillingDate: Date;
  } | null;
}

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function formatCycle(cycle: string) {
  return cycle.charAt(0) + cycle.slice(1).toLowerCase();
}

/**
 * Builds the invoice PDF entirely in memory (a Buffer, not a stream piped to
 * a response) since it has two independent consumers - the download endpoint
 * (invoice.controller.ts) and the email attachment (email.service.ts) - and
 * both need the same finished bytes rather than a one-shot stream. Kept to
 * pdfkit's plain text/line layout, same reasoning as reportsExport.service.ts's
 * streamReportPdf: no real table/chart primitives exist in pdfkit worth
 * fighting for a two-column invoice.
 */
export function buildInvoicePdfBuffer(invoice: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("DealFlow360", { align: "left" });
    doc.fontSize(10).fillColor("#666").text("Invoice", { align: "left" });
    doc.fillColor("#000");
    doc.moveDown(1);

    doc.fontSize(14).text(`Invoice ${invoice.invoiceNumber}`);
    doc.fontSize(9).fillColor("#666").text(`Status: ${invoice.status}`);
    doc.fillColor("#000");
    doc.moveDown(0.8);

    doc.fontSize(10);
    doc.text(`Bill To: ${invoice.customer.name} (${invoice.customer.tier} tier)`);
    doc.text(`Issued Date: ${invoice.issuedDate.toLocaleDateString()}`);
    doc.text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`);
    if (invoice.paidAt) {
      doc.text(`Paid Date: ${invoice.paidAt.toLocaleDateString()}`);
    }
    doc.moveDown(1);

    if (invoice.quote) {
      doc.fontSize(12).text("Order Details");
      doc.fontSize(9).fillColor("#666").text(
        `Order ID: ${invoice.quote.quoteNumber}  ·  Order Date: ${invoice.quote.orderDate.toLocaleDateString()}`
      );
      doc.fillColor("#000");
      doc.moveDown(0.5);

      doc.fontSize(9);
      for (const item of invoice.quote.items) {
        doc.text(
          `${item.productName} (SKU: ${item.sku})  -  Qty: ${item.quantity}  -  Unit Price: ` +
            `${formatCurrency(item.unitPrice)}  -  Line Total: ${formatCurrency(item.lineTotal)}`
        );
      }
      doc.moveDown(1);
    }

    if (invoice.subscription) {
      doc.fontSize(12).text("Recurring Payment");
      doc.fontSize(9);
      doc.text(`Product: ${invoice.subscription.productName}`);
      doc.text(`Billing Cycle: ${formatCycle(invoice.subscription.billingCycle)}`);
      doc.text(`Quantity: ${invoice.subscription.quantity}`);
      doc.text(`Next Billing Date: ${invoice.subscription.nextBillingDate.toLocaleDateString()}`);
      doc.moveDown(1);
    }

    doc.moveDown(0.5);
    doc.fontSize(13).text(`Total Amount: ${formatCurrency(invoice.amount)}`, { align: "right" });
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor("#666").text("Thank you for your business. - DealFlow360 Billing", { align: "center" });

    doc.end();
  });
}
