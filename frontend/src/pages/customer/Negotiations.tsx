import { Fragment, useEffect, useState } from "react";
import axios from "axios";
import { listMyNegotiableQuotes, negotiateQuote } from "../../api/customerPortal";
import type { NegotiableQuote } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// Lists quotes the customer can act on: APPROVED (they may still want a
// bigger discount) or REJECTED (at any approval level - Manager, Finance or
// Admin). Negotiating sends the quote back to the Sales Rep for revision -
// it drops out of this list once negotiated, and reappears here only if it
// makes it all the way back through the chain to APPROVED or REJECTED again.
export function Negotiations() {
  const [quotes, setQuotes] = useState<NegotiableQuote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openQuoteId, setOpenQuoteId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [requestedDiscount, setRequestedDiscount] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    listMyNegotiableQuotes()
      .then(setQuotes)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load your quotes.")));
  }

  useEffect(load, []);

  function openNegotiation(quote: NegotiableQuote) {
    setOpenQuoteId(quote.id);
    setNote("");
    setRequestedDiscount(String(quote.discountPercentage));
    setActionError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(quoteId: string) {
    if (note.trim().length === 0) {
      setActionError("Please add a note explaining what you'd like to negotiate.");
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      await negotiateQuote(quoteId, {
        note: note.trim(),
        requestedDiscountPercentage: requestedDiscount ? Number(requestedDiscount) : undefined,
      });
      setSuccessMessage("Your negotiation request has been sent to our sales team.");
      setOpenQuoteId(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to submit your negotiation request."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Negotiations</h1>
        <p className="page-subtitle">
          If a quote was approved but you'd like a bigger discount, or was rejected, you can negotiate here.
        </p>
      </div>

      {successMessage && <div className="banner-success">{successMessage}</div>}

      <div className="sales-card">
        {quotes === null ? (
          <p className="sales-empty">Loading...</p>
        ) : quotes.length === 0 ? (
          <p className="sales-empty">You have no quotes available for negotiation right now.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Products</th>
                <th>Discount</th>
                <th>Total</th>
                <th>Status</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <Fragment key={quote.id}>
                  <tr>
                    <td>{quote.quoteNumber}</td>
                    <td>{quote.items.map((item) => `${item.productName} (x${item.quantity})`).join(", ")}</td>
                    <td>{quote.discountPercentage}%</td>
                    <td>{formatCurrency(quote.totalAmount)}</td>
                    <td>
                      <span className={`status-badge status-${quote.status}`}>{quote.status}</span>
                    </td>
                    <td>{quote.rejectionReason ?? "—"}</td>
                    <td>
                      {quote.negotiationStatus === "IN_PROGRESS" ? (
                        <span className="status-badge status-IN_PROGRESS">Negotiation in progress</span>
                      ) : openQuoteId === quote.id ? (
                        <button className="sales-btn" onClick={() => setOpenQuoteId(null)} disabled={isSubmitting}>
                          Cancel
                        </button>
                      ) : (
                        <button className="sales-btn sales-btn-primary" onClick={() => openNegotiation(quote)}>
                          Negotiate
                        </button>
                      )}
                    </td>
                  </tr>
                  {openQuoteId === quote.id && (
                    <tr>
                      <td colSpan={7}>
                        {actionError && <div className="banner-error">{actionError}</div>}
                        <div className="product-search-row">
                          <label>
                            Requested Discount %:{" "}
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              value={requestedDiscount}
                              onChange={(e) => setRequestedDiscount(e.target.value)}
                              style={{ width: 90 }}
                            />
                          </label>
                        </div>
                        <textarea
                          placeholder="Explain what you'd like to negotiate..."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                          style={{
                            width: "100%",
                            padding: "0.6rem",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            fontFamily: "inherit",
                            marginBottom: "0.75rem",
                          }}
                        />
                        <div className="sales-actions">
                          <button
                            className="sales-btn sales-btn-primary"
                            onClick={() => handleSubmit(quote.id)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "Submitting..." : "Send to Sales Team"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
