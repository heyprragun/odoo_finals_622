import type { Response } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { getReportSummary } from "./reports.service";

type ReportSummary = Awaited<ReturnType<typeof getReportSummary>>;

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

/**
 * Streams a PDF straight to the response - kept deliberately to plain text/
 * simple layout (no attempt to reproduce the web UI's charts) since pdfkit
 * has no real table/chart primitives; this is a tabular data export, not a
 * pixel copy of the dashboard.
 */
export function streamReportPdf(res: Response, summary: ReportSummary) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="dealflow360-report.pdf"');
  doc.pipe(res);

  doc.fontSize(20).text("DealFlow360 - Admin Report", { align: "center" });
  doc.moveDown(0.3);
  doc
    .fontSize(9)
    .fillColor("#666")
    .text(`Generated ${summary.generatedAt.toLocaleString()}`, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(1.5);

  doc.fontSize(14).text("Team Performance");
  doc.moveDown(0.4);
  doc.fontSize(8);
  for (const member of summary.team) {
    doc.text(
      `${member.name}  (${member.role})  -  Owned deals: ${member.ownedQuotesTotal} ` +
        `[Approved ${member.ownedQuotesApproved} / Rejected ${member.ownedQuotesRejected} / Pending ${member.ownedQuotesPending}]  ` +
        `-  Approvals given: ${member.approvalsGiven}  Returns: ${member.returnsGiven}  Rejections: ${member.rejectionsGiven}`
    );
  }
  doc.moveDown(1.2);

  doc.fontSize(14).text("Product Performance - Best Sellers");
  doc.moveDown(0.4);
  doc.fontSize(8);
  for (const product of summary.products.bestSelling) {
    doc.text(
      `${product.name} (${product.sku})  -  Units sold: ${product.unitsSold}  -  Revenue: ${formatCurrency(
        product.revenue
      )}  -  Avg discount: ${product.averageDiscountPercentage.toFixed(1)}%`
    );
  }
  doc.moveDown(1);

  doc.fontSize(14).text("Product Performance - Least Sellers");
  doc.moveDown(0.4);
  doc.fontSize(8);
  for (const product of summary.products.leastSelling) {
    doc.text(
      `${product.name} (${product.sku})  -  Units sold: ${product.unitsSold}  -  Revenue: ${formatCurrency(
        product.revenue
      )}  -  Avg discount: ${product.averageDiscountPercentage.toFixed(1)}%`
    );
  }
  doc.moveDown(1.2);

  doc.fontSize(14).text("Orders Under Review");
  doc.moveDown(0.4);
  doc.fontSize(8);
  if (summary.orders.underReview.length === 0) {
    doc.text("None.");
  }
  for (const order of summary.orders.underReview) {
    doc.text(
      `${order.quoteNumber}  -  ${order.customerName}  -  ${order.salesRepName}  -  ${order.status}  -  ${formatCurrency(order.totalAmount)}`
    );
  }
  doc.moveDown(1);

  doc.fontSize(14).text("Orders To Be Shipped");
  doc.moveDown(0.4);
  doc.fontSize(8);
  if (summary.orders.toBeShipped.length === 0) {
    doc.text("None.");
  }
  for (const order of summary.orders.toBeShipped) {
    doc.text(
      `${order.quoteNumber}  -  ${order.customerName}  -  ${order.salesRepName}  -  ${formatCurrency(order.totalAmount)}`
    );
  }
  doc.moveDown(1.2);

  doc.fontSize(14).text("Customers by Tier");
  doc.moveDown(0.4);
  doc.fontSize(8);
  for (const customer of summary.customers) {
    doc.text(
      `${customer.name}  (${customer.tier})  -  Orders: ${customer.totalOrders}  -  Approved spend: ${formatCurrency(
        customer.totalApprovedSpend
      )}  -  Active subscriptions: ${customer.activeSubscriptions}`
    );
  }

  doc.end();
}

export async function buildReportWorkbook(summary: ReportSummary): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DealFlow360";
  workbook.created = summary.generatedAt;

  const teamSheet = workbook.addWorksheet("Team Performance");
  teamSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Role", key: "role", width: 14 },
    { header: "Owned Total", key: "ownedQuotesTotal", width: 14 },
    { header: "Owned Approved", key: "ownedQuotesApproved", width: 16 },
    { header: "Owned Rejected", key: "ownedQuotesRejected", width: 16 },
    { header: "Owned Pending", key: "ownedQuotesPending", width: 14 },
    { header: "Approvals Given", key: "approvalsGiven", width: 16 },
    { header: "Returns Given", key: "returnsGiven", width: 14 },
    { header: "Rejections Given", key: "rejectionsGiven", width: 16 },
  ];
  teamSheet.addRows(summary.team);

  const productSheet = workbook.addWorksheet("Product Performance");
  productSheet.columns = [
    { header: "Product", key: "name", width: 26 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Category", key: "category", width: 14 },
    { header: "Units Sold", key: "unitsSold", width: 12 },
    { header: "Revenue", key: "revenue", width: 14 },
    { header: "Avg Discount %", key: "averageDiscountPercentage", width: 16 },
  ];
  productSheet.addRows(summary.products.all);

  const ordersSheet = workbook.addWorksheet("Orders");
  ordersSheet.columns = [
    { header: "Quote #", key: "quoteNumber", width: 12 },
    { header: "Customer", key: "customerName", width: 22 },
    { header: "Sales Rep", key: "salesRepName", width: 20 },
    { header: "Status", key: "status", width: 24 },
    { header: "Amount", key: "totalAmount", width: 14 },
    { header: "Items", key: "itemSummary", width: 45 },
    { header: "Created", key: "createdAt", width: 20 },
  ];
  ordersSheet.addRows([...summary.orders.underReview, ...summary.orders.toBeShipped]);

  const customerSheet = workbook.addWorksheet("Customers");
  customerSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "Total Orders", key: "totalOrders", width: 14 },
    { header: "Approved Spend", key: "totalApprovedSpend", width: 16 },
    { header: "Active Subscriptions", key: "activeSubscriptions", width: 18 },
  ];
  customerSheet.addRows(summary.customers);

  return workbook;
}

export async function streamReportXlsx(res: Response, summary: ReportSummary) {
  const workbook = await buildReportWorkbook(summary);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="dealflow360-report.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
}
