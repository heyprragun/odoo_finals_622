import { Fragment, useEffect, useState } from "react";
import axios from "axios";
import {
  listMyDiscountReviews,
  listMyNegotiableQuotes,
  negotiateQuote,
  resolveDiscountReview,
} from "../../api/customerPortal";
import { useSortableTable } from "../../hooks/useSortableTable";
import { SortableHeader } from "../../components/SortableHeader";
import type { DiscountReview, NegotiableQuote } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getReviewSortValue(review: DiscountReview, key: string): string | number | null {
  switch (key) {
    case "products":
      return review.items.map((i) => i.productName).join(", ");
    case "expected":
      return review.expectedDiscountPercentage;
    case "offered":
      return review.proposedDiscountPercentage;
    default:
      return null;
  }
}

function getNegotiableSortValue(quote: NegotiableQuote, key: string): string | number | null {
  switch (key) {
    case "quoteNumber":
      return quote.quoteNumber;
    case "discount":
      return quote.discountPercentage;
    case "total":
      return quote.totalAmount;
    case "status":
      return quote.status;
    default:
      return null;
  }
}

// An order where the Sales Rep offered less discount than expected -
// submission to Manager/Finance approval is blocked until this is resolved
// here (accept the lower offer, or counter with a different expectation).
function DiscountReviewsSection() {
  const [reviews, setReviews] = useState<DiscountReview[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newExpected, setNewExpected] = useState("");
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    listMyDiscountReviews()
      .then(setReviews)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load discount reviews.")));
  }

  useEffect(load, []);

  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(reviews ?? [], getReviewSortValue, "products");

  function openReview(review: DiscountReview) {
    setOpenId(review.id);
    // Pre-filled with the Rep's offer - clicking straight through accepts it.
    setNewExpected(String(review.proposedDiscountPercentage ?? ""));
    setNote("");
    setActionError(null);
    setSuccessMessage(null);
  }

  async function handleResolve(requestId: string) {
    const value = Number(newExpected);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setActionError("Enter a valid discount percentage.");
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      await resolveDiscountReview(requestId, value, note.trim() || undefined);
      setSuccessMessage("Resolved - your Sales Rep can now proceed.");
      setOpenId(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to resolve this review."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) return <div className="banner-error">{loadError}</div>;
  if (reviews === null) return null;
  if (reviews.length === 0) return null;

  return (
    <div className="sales-card">
      <h2>Discount Review Needed</h2>
      <p className="page-subtitle">
        Your Sales Rep offered less discount than you asked for on these orders - accept their offer or
        counter with a different discount. Nothing goes to approval until this is resolved.
      </p>
      {successMessage && <div className="banner-success">{successMessage}</div>}
      <table className="sales-table">
        <thead>
          <tr>
            <SortableHeader label="Products" sortKey="products" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            <SortableHeader label="You Expected" sortKey="expected" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            <SortableHeader label="Rep Offered" sortKey="offered" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((review) => (
            <Fragment key={review.id}>
              <tr>
                <td>{review.items.map((item) => `${item.productName} (x${item.quantity})`).join(", ")}</td>
                <td>{review.expectedDiscountPercentage}%</td>
                <td>{review.proposedDiscountPercentage}%</td>
                <td>
                  {openId === review.id ? (
                    <button className="sales-btn" onClick={() => setOpenId(null)} disabled={isSubmitting}>
                      Cancel
                    </button>
                  ) : (
                    <button className="sales-btn sales-btn-primary" onClick={() => openReview(review)}>
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
              {openId === review.id && (
                <tr>
                  <td colSpan={4}>
                    {actionError && <div className="banner-error">{actionError}</div>}
                    <div className="product-search-row">
                      <label>
                        Discount You'll Accept %:{" "}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={newExpected}
                          onChange={(e) => setNewExpected(e.target.value)}
                          style={{ width: 90 }}
                        />
                      </label>
                    </div>
                    <textarea
                      placeholder="Optional comment for your Sales Rep..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
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
                        onClick={() => handleResolve(review.id)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Submitting..." : "Confirm"}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
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

  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(quotes ?? [], getNegotiableSortValue, "quoteNumber");

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

      <DiscountReviewsSection />

      <div className="sales-card">
        {quotes === null ? (
          <p className="sales-empty">Loading...</p>
        ) : quotes.length === 0 ? (
          <p className="sales-empty">You have no quotes available for negotiation right now.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <SortableHeader label="Quote #" sortKey="quoteNumber" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <th>Products</th>
                <SortableHeader label="Discount" sortKey="discount" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Total" sortKey="total" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((quote) => (
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
