import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getInvoiceDetail, markInvoiceAsPaid } from "../../api/invoices";
import type { InvoiceDetail as InvoiceDetailType } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatCycle(cycle: string) {
  return cycle.charAt(0) + cycle.slice(1).toLowerCase();
}

function buildSummaryText(detail: InvoiceDetailType): string {
  const lines: string[] = [];
  lines.push("DealFlow360 - Invoice Summary");
  lines.push("=============================");
  lines.push(`Invoice Number: ${detail.invoiceNumber}`);
  lines.push(`Customer: ${detail.customer.name} (${detail.customer.tier})`);
  lines.push(`Status: ${detail.status}`);
  lines.push(`Issued Date: ${new Date(detail.issuedDate).toLocaleDateString()}`);
  lines.push(`Due Date: ${new Date(detail.dueDate).toLocaleDateString()}`);
  if (detail.paidAt) {
    lines.push(`Paid Date: ${new Date(detail.paidAt).toLocaleDateString()}`);
  }
  lines.push(`Amount: ${formatCurrency(detail.amount)}`);
  lines.push("");

  if (detail.quote) {
    lines.push("Order Details");
    lines.push("-------------");
    lines.push(`Order ID (Quote): ${detail.quote.quoteNumber}`);
    lines.push(`Order Date: ${new Date(detail.quote.orderDate).toLocaleDateString()}`);
    lines.push("");
    lines.push("Line Items:");
    for (const item of detail.quote.items) {
      lines.push(
        `- ${item.productName} (SKU: ${item.sku}) | Qty: ${item.quantity} | Unit Price: ${formatCurrency(
          item.unitPrice
        )} | Line Total: ${formatCurrency(item.lineTotal)}`
      );
    }
    lines.push("");
  }

  if (detail.subscription) {
    lines.push("Recurring Payment");
    lines.push("------------------");
    lines.push(`Product: ${detail.subscription.productName}`);
    lines.push(`Billing Cycle: ${formatCycle(detail.subscription.billingCycle)}`);
    lines.push(`Quantity: ${detail.subscription.quantity}`);
    lines.push(`Subscription Status: ${detail.subscription.status}`);
    lines.push(`Next Billing Date: ${new Date(detail.subscription.nextBillingDate).toLocaleDateString()}`);
    lines.push("");
  } else {
    lines.push("Recurring Payment: N/A");
    lines.push("");
  }

  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAllowed = user?.role === "FINANCE" || user?.role === "ADMIN";

  const [detail, setDetail] = useState<InvoiceDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);

  useEffect(() => {
    if (!id || !isAllowed) return;
    getInvoiceDetail(id)
      .then(setDetail)
      .catch((err) =>
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load this invoice."
        )
      );
  }, [id, isAllowed]);

  if (!isAllowed) {
    return <NoAccessBlock title="Invoices" />;
  }

  async function handleMarkAsPaid() {
    if (!id) return;
    setError(null);
    setIsMarking(true);
    try {
      setDetail(await markInvoiceAsPaid(id));
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to mark this invoice as paid."
      );
    } finally {
      setIsMarking(false);
    }
  }

  function handleDownloadSummary() {
    if (!detail) return;
    downloadTextFile(`${detail.invoiceNumber}-summary.txt`, buildSummaryText(detail));
  }

  if (error) {
    return (
      <div className="sales-page">
        <div className="banner-error">{error}</div>
        <Link className="sales-back-link" to="/sales/invoices">
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="sales-page">
        <p className="sales-empty">Loading...</p>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>
            Invoice {detail.invoiceNumber} ({detail.customer.name})
          </h1>
          <p className="page-subtitle">
            <span className={`status-badge status-${detail.status}`}>{detail.status}</span>
            {"  ·  Due " + new Date(detail.dueDate).toLocaleDateString()}
          </p>
        </div>
        <Link className="sales-back-link" to="/sales/invoices">
          ← Back to Invoices
        </Link>
      </div>

      <div className="sales-card">
        <h2>Invoice</h2>
        <div className="quote-summary-row">
          <span>Customer</span>
          <span>
            {detail.customer.name} <span className="tier-badge">{detail.customer.tier}</span>
          </span>
        </div>
        <div className="quote-summary-row">
          <span>Issued Date</span>
          <span>{new Date(detail.issuedDate).toLocaleDateString()}</span>
        </div>
        <div className="quote-summary-row">
          <span>Due Date</span>
          <span>{new Date(detail.dueDate).toLocaleDateString()}</span>
        </div>
        {detail.paidAt && (
          <div className="quote-summary-row">
            <span>Paid Date</span>
            <span>{new Date(detail.paidAt).toLocaleDateString()}</span>
          </div>
        )}
        <div className="quote-summary-row total">
          <span>Amount</span>
          <span>{formatCurrency(detail.amount)}</span>
        </div>
      </div>

      {detail.quote && (
        <div className="sales-card">
          <h2>Order Details</h2>
          <p className="page-subtitle">
            Order ID: {detail.quote.quoteNumber} · Order Date:{" "}
            {new Date(detail.quote.orderDate).toLocaleDateString()}
          </p>
          <table className="sales-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.quote.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.productName}</td>
                  <td>{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sales-card">
        <h2>Recurring Payment</h2>
        {detail.subscription ? (
          <>
            <div className="quote-summary-row">
              <span>Product</span>
              <span>{detail.subscription.productName}</span>
            </div>
            <div className="quote-summary-row">
              <span>Billing Cycle</span>
              <span>{formatCycle(detail.subscription.billingCycle)}</span>
            </div>
            <div className="quote-summary-row">
              <span>Quantity</span>
              <span>{detail.subscription.quantity}</span>
            </div>
            <div className="quote-summary-row">
              <span>Subscription Status</span>
              <span className={`status-badge status-${detail.subscription.status}`}>
                {detail.subscription.status}
              </span>
            </div>
            <div className="quote-summary-row">
              <span>Next Billing Date</span>
              <span>{new Date(detail.subscription.nextBillingDate).toLocaleDateString()}</span>
            </div>
          </>
        ) : (
          <p className="sales-empty">This is a one-time invoice - no recurring payment involved.</p>
        )}
      </div>

      <div className="sales-actions">
        {detail.status === "UNPAID" && (
          <button className="sales-btn sales-btn-primary" onClick={handleMarkAsPaid} disabled={isMarking}>
            {isMarking ? "Updating..." : "Mark as Paid"}
          </button>
        )}
        <button className="sales-btn" onClick={handleDownloadSummary}>
          Download Summary
        </button>
      </div>
    </div>
  );
}
