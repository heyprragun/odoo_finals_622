import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { cancelMySubscription, createMyRequest, getMySubscription } from "../../api/customerPortal";
import type { BillingCycle, CustomerSubscriptionDetail as CustomerSubscriptionDetailType } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const CYCLES: BillingCycle[] = ["MONTHLY", "QUARTERLY", "ANNUALLY"];

function formatCycle(cycle: string) {
  return cycle.charAt(0) + cycle.slice(1).toLowerCase();
}

export function CustomerSubscriptionDetail() {
  const { id } = useParams<{ id: string }>();

  const [sub, setSub] = useState<CustomerSubscriptionDetailType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const [showChangeForm, setShowChangeForm] = useState(false);
  const [newCycle, setNewCycle] = useState<BillingCycle>("MONTHLY");
  const [changeNotes, setChangeNotes] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  function reload() {
    if (!id) return;
    getMySubscription(id)
      .then((data) => {
        setSub(data);
        // The cycle picker excludes the current cycle (it must actually
        // change) - default to the first option that isn't it, so the
        // select's initial value always matches a rendered <option>.
        setNewCycle(CYCLES.find((cycle) => cycle !== data.billingCycle) ?? data.billingCycle);
      })
      .catch((err) => setLoadError(errorMessage(err, "Failed to load this subscription.")));
  }

  useEffect(reload, [id]);

  async function handleCancel() {
    if (!id) return;
    setActionError(null);
    setIsCancelling(true);
    try {
      const updated = await cancelMySubscription(id, cancelReason.trim() || undefined);
      setSub(updated);
      setShowCancelForm(false);
      setSuccessMessage("Subscription cancelled.");
    } catch (err) {
      setActionError(errorMessage(err, "Failed to cancel this subscription."));
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleChangePlan() {
    if (!id || !sub) return;
    setActionError(null);
    setIsChanging(true);
    try {
      await createMyRequest({
        items: [{ productId: sub.productId, quantity: sub.quantity }],
        isRecurring: true,
        billingCycle: newCycle,
        notes: changeNotes.trim() || undefined,
        modifiesSubscriptionId: sub.id,
      });
      setShowChangeForm(false);
      setChangeNotes("");
      setSuccessMessage("Your plan change request has been sent to our sales team for approval.");
      reload();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to submit your plan change request."));
    } finally {
      setIsChanging(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/portal/subscriptions">
          ← Back to Subscriptions
        </Link>
      </div>
    );
  }

  if (!sub) {
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
            {sub.productName} <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
          </h1>
          <p className="page-subtitle">SKU: {sub.sku}</p>
        </div>
        <Link className="sales-back-link" to="/portal/subscriptions">
          ← Back to Subscriptions
        </Link>
      </div>

      {actionError && <div className="banner-error">{actionError}</div>}
      {successMessage && <div className="banner-success">{successMessage}</div>}
      {sub.pendingPlanChange && (
        <div className="banner-error">
          A plan change request for this subscription is already in progress with our sales team.
        </div>
      )}

      <div className="sales-summary-grid">
        <div className="sales-stat">
          <div className="value">{sub.quantity}</div>
          <div className="label">Quantity</div>
        </div>
        <div className="sales-stat">
          <div className="value">{formatCurrency(sub.unitPrice)}</div>
          <div className="label">Unit Price</div>
        </div>
        <div className="sales-stat">
          <div className="value">{formatCycle(sub.billingCycle)}</div>
          <div className="label">Billing Cycle</div>
        </div>
        <div className="sales-stat">
          <div className="value">{new Date(sub.nextBillingDate).toLocaleDateString()}</div>
          <div className="label">Next Billing Date</div>
        </div>
      </div>

      <div className="sales-card">
        <h2>History</h2>
        {sub.events.length === 0 ? (
          <p className="sales-empty">No activity yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {sub.events.map((event) => (
                <tr key={event.id}>
                  <td>{event.type}</td>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.amount === null ? "—" : formatCurrency(event.amount)}</td>
                  <td>{event.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {sub.modifiable && (
        <div className="sales-card">
          <h2>Change Subscription Plan</h2>
          {!showChangeForm ? (
            <div className="sales-actions">
              <button className="sales-btn sales-btn-primary" onClick={() => setShowChangeForm(true)}>
                Change Plan
              </button>
            </div>
          ) : (
            <>
              <div className="product-search-row">
                <label>
                  New Billing Cycle:{" "}
                  <select value={newCycle} onChange={(e) => setNewCycle(e.target.value as BillingCycle)}>
                    {CYCLES.filter((cycle) => cycle !== sub.billingCycle).map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {formatCycle(cycle)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <textarea
                placeholder="Any comments for our sales team (optional)..."
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  fontFamily: "inherit",
                  margin: "0.75rem 0",
                }}
              />
              <p className="explainer-text">
                This goes through the same sales and approval process as a normal order. Your current plan stays
                active until it's approved.
              </p>
              <div className="sales-actions">
                <button className="sales-btn sales-btn-primary" onClick={handleChangePlan} disabled={isChanging}>
                  {isChanging ? "Submitting..." : "Submit Plan Change"}
                </button>
                <button
                  className="sales-btn"
                  onClick={() => {
                    setShowChangeForm(false);
                    setChangeNotes("");
                  }}
                  disabled={isChanging}
                >
                  Never Mind
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {sub.cancellable && (
        <div className="sales-card">
          <h2>Cancel Subscription</h2>
          {!showCancelForm ? (
            <div className="sales-actions">
              <button className="sales-btn sales-btn-danger" onClick={() => setShowCancelForm(true)}>
                Cancel Subscription
              </button>
            </div>
          ) : (
            <>
              <textarea
                placeholder="Optional reason for cancelling..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
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
                  className="sales-btn sales-btn-danger"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                </button>
                <button
                  className="sales-btn"
                  onClick={() => {
                    setShowCancelForm(false);
                    setCancelReason("");
                  }}
                  disabled={isCancelling}
                >
                  Never Mind
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
