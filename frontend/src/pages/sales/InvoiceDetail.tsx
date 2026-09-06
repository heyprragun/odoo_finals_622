import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { downloadInvoicePdf, emailInvoice, getInvoiceDetail, markInvoiceAsPaid } from "../../api/invoices";
import type { InvoiceDetail as InvoiceDetailType } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatCycle(cycle: string) {
  return cycle.charAt(0) + cycle.slice(1).toLowerCase();
}

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAllowed = user?.role === "FINANCE" || user?.role === "ADMIN";

  const [detail, setDetail] = useState<InvoiceDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<{ previewUrl: string | null } | null>(null);

  useEffect(() => {
    if (!id || !isAllowed) return;
    getInvoiceDetail(id)
      .then((d) => {
        setDetail(d);
        if (d.customerEmail) setEmailAddress(d.customerEmail);
      })
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

  async function handleDownloadPdf() {
    if (!id || !detail) return;
    setError(null);
    setIsDownloading(true);
    try {
      await downloadInvoicePdf(id, `${detail.invoiceNumber}.pdf`);
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to download this invoice."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSendEmail() {
    if (!id || !emailAddress.trim()) return;
    setEmailError(null);
    setEmailResult(null);
    setIsSendingEmail(true);
    try {
      setEmailResult(await emailInvoice(id, emailAddress.trim()));
    } catch (err) {
      setEmailError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to email this invoice."
      );
    } finally {
      setIsSendingEmail(false);
    }
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
        <button className="sales-btn" onClick={handleDownloadPdf} disabled={isDownloading}>
          {isDownloading ? "Downloading..." : "Download PDF"}
        </button>
        <button
          className="sales-btn"
          onClick={() => {
            setShowEmailForm((v) => !v);
            setEmailError(null);
            setEmailResult(null);
          }}
        >
          Email Invoice
        </button>
      </div>

      {showEmailForm && (
        <div className="sales-card">
          <h2>Email Invoice to Customer</h2>
          {emailError && <div className="banner-error">{emailError}</div>}
          {emailResult && (
            <div className="banner-success">
              Invoice emailed to {emailAddress}.
              {emailResult.previewUrl && (
                <>
                  {" "}
                  No live mail server is configured, so this went to a test inbox instead of a real one —{" "}
                  <a href={emailResult.previewUrl} target="_blank" rel="noreferrer">
                    view the sent email
                  </a>
                  .
                </>
              )}
            </div>
          )}
          <div className="product-search-row">
            <input
              type="email"
              placeholder="customer@example.com"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              style={{ flex: 1, minWidth: 240 }}
            />
            <button
              className="sales-btn sales-btn-primary"
              onClick={handleSendEmail}
              disabled={isSendingEmail || !emailAddress.trim()}
            >
              {isSendingEmail ? "Sending..." : "Send"}
            </button>
          </div>
          <p className="explainer-text" style={{ margin: 0 }}>
            Sends the same PDF as "Download PDF" as an attachment to the address above.
          </p>
        </div>
      )}
    </div>
  );
}
