import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getDealHealthDetail, nudgeSalesRep, rejectFlaggedDeal } from "../../api/dealHealth";
import type { DealHealthDetail as DealHealthDetailType } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import { TeamDiscussion } from "./TeamDiscussion";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

type PendingAction = "reject" | "nudge" | null;

export function DealHealthDetail() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { user } = useAuth();
  const isDenied = user?.role !== "MANAGER" && user?.role !== "ADMIN";

  const [detail, setDetail] = useState<DealHealthDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [note, setNote] = useState("");
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!quoteId || isDenied) return;
    getDealHealthDetail(quoteId)
      .then(setDetail)
      .catch((err) => setError(errorMessage(err, "Failed to load this deal.")));
  }, [quoteId, isDenied]);

  async function handleConfirmAction() {
    if (!quoteId || !pendingAction) return;
    setActionError(null);
    setSuccessMessage(null);
    setIsActing(true);
    try {
      const updated =
        pendingAction === "reject" ? await rejectFlaggedDeal(quoteId, note) : await nudgeSalesRep(quoteId, note);
      setDetail(updated);
      setPendingAction(null);
      setNote("");
      setSuccessMessage(
        pendingAction === "reject" ? "Deal rejected." : "Sales Rep nudged - they'll see this on the quote."
      );
    } catch (err) {
      setActionError(errorMessage(err, "Failed to submit this decision."));
    } finally {
      setIsActing(false);
    }
  }

  if (isDenied) {
    return <NoAccessBlock title="Deal Health" />;
  }

  if (error) {
    return (
      <div className="sales-page">
        <div className="banner-error">{error}</div>
        <Link className="sales-back-link" to="/sales/deal-health">
          ← Back to Deal Health
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

  const { quote, flags } = detail;

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>
            Deal Health: {quote.quoteNumber}{" "}
            <span className={`status-badge status-${quote.status}`}>{quote.status}</span>
          </h1>
          <p className="page-subtitle">
            {quote.customer.name} <span className="tier-badge">{quote.customer.tier}</span> · Sales Rep:{" "}
            {quote.salesRep.name}
          </p>
        </div>
        <Link className="sales-back-link" to="/sales/deal-health">
          ← Back to Deal Health
        </Link>
      </div>

      {actionError && <div className="banner-error">{actionError}</div>}
      {successMessage && <div className="banner-success">{successMessage}</div>}

      <div className="sales-summary-grid">
        <div className="sales-stat">
          <div className="value">{formatCurrency(quote.totalAmount)}</div>
          <div className="label">Total Amount</div>
        </div>
        <div className="sales-stat">
          <div className="value">{quote.discountPercentage}%</div>
          <div className="label">Discount Given</div>
        </div>
        <div className="sales-stat">
          <div className="value">{new Date(quote.createdAt).toLocaleDateString()}</div>
          <div className="label">Created</div>
        </div>
        <div className="sales-stat">
          <div className="value">{new Date(quote.updatedAt).toLocaleDateString()}</div>
          <div className="label">Last Activity</div>
        </div>
      </div>

      {flags.length === 0 ? (
        <div className="sales-card">
          <p className="sales-empty">
            This deal is no longer flagged - it may have been resolved since the Deal Health list was loaded.
          </p>
        </div>
      ) : (
        flags.map((flag) => {
          if (flag.flagType === "STALLED") {
            return (
              <div className="sales-card" key={flag.flagType}>
                <h2>
                  <span className="flag-badge flag-STALLED">Stalled Deal</span>
                </h2>
                <p>
                  No activity for <strong>{flag.daysSinceActivity} days</strong> (flagged past{" "}
                  {flag.thresholdDays} days with no update).
                </p>
                <p className="explainer-text">Last activity: {new Date(flag.lastActivityAt).toLocaleString()}</p>
                {flag.lastAuditEntry ? (
                  <p className="explainer-text">
                    Last logged action: <strong>{flag.lastAuditEntry.action}</strong> by{" "}
                    {flag.lastAuditEntry.user} on {new Date(flag.lastAuditEntry.createdAt).toLocaleString()}
                    {flag.lastAuditEntry.note ? ` — "${flag.lastAuditEntry.note}"` : ""}
                  </p>
                ) : (
                  <p className="explainer-text">No approval-workflow activity has been logged on this deal yet.</p>
                )}
              </div>
            );
          }

          if (flag.flagType === "DISCOUNT_ANOMALY") {
            return (
              <div className="sales-card" key={flag.flagType}>
                <h2>
                  <span className="flag-badge flag-DISCOUNT_ANOMALY">Discount Anomaly</span>
                </h2>
                <p>
                  This quote offers <strong>{flag.discountPercentage}%</strong>, which is{" "}
                  <strong>{flag.overByPoints} points</strong> above {quote.salesRep.name}'s own historical average
                  of <strong>{flag.repAverageDiscountPercentage}%</strong> (based on {flag.repHistoryCount} prior
                  quotes).
                </p>
                <p className="explainer-text">
                  Flagged when a discount exceeds a Rep's own average by more than {flag.thresholdPoints} points -
                  this is relative to their personal norm, not the company-wide tier/category discount ceilings.
                </p>
              </div>
            );
          }

          return (
            <div className="sales-card" key={flag.flagType}>
              <h2>
                <span className="flag-badge flag-DELIVERY_SLIPPAGE">Delivery Slippage</span>
              </h2>
              <p>
                Approved <strong>{flag.daysSinceApproval} days ago</strong> (past the {flag.thresholdDays}-day
                fulfillment timeline), and the following items still don't have full warehouse stock allocated:
              </p>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered</th>
                    <th>Allocated</th>
                    <th>Short By</th>
                  </tr>
                </thead>
                <tbody>
                  {flag.shortItems.map((item) => (
                    <tr key={item.productName}>
                      <td>{item.productName}</td>
                      <td>{item.orderedQuantity}</td>
                      <td>{item.allocatedQuantity}</td>
                      <td className="over-limit">{item.shortBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      <TeamDiscussion quoteId={quote.id} />

      {flags.length > 0 && (
        <div className="sales-card">
          <h2>Decision</h2>
          {pendingAction && (
            <div className="product-search-row">
              <input
                type="text"
                placeholder={`Note for ${pendingAction === "reject" ? "rejecting this deal" : "the nudge"}...`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          )}
          <div className="sales-actions">
            {!pendingAction && (
              <>
                <button
                  className="sales-btn sales-btn-danger"
                  onClick={() => setPendingAction("reject")}
                  disabled={isActing}
                >
                  Reject Deal
                </button>
                <button
                  className="sales-btn"
                  onClick={() => setPendingAction("nudge")}
                  disabled={isActing}
                >
                  Nudge Sales Rep
                </button>
              </>
            )}
            {pendingAction && (
              <>
                <button
                  className={`sales-btn ${pendingAction === "reject" ? "sales-btn-danger" : "sales-btn-primary"}`}
                  onClick={handleConfirmAction}
                  disabled={isActing || note.trim().length < 3}
                >
                  {isActing ? "Submitting..." : pendingAction === "reject" ? "Confirm Reject" : "Confirm Nudge"}
                </button>
                <button
                  className="sales-btn"
                  onClick={() => {
                    setPendingAction(null);
                    setNote("");
                  }}
                  disabled={isActing}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          {quote.status === "APPROVED" && pendingAction === "reject" && (
            <p className="explainer-text" style={{ marginTop: "0.6rem" }}>
              This order is already confirmed - rejecting it will cancel the order along with its generated
              subscriptions and any still-unpaid invoices.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
