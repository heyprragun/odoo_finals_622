import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import {
  cancelSubscription,
  changeSubscriptionQuantity,
  getCompanySubscriptionDetail,
  pauseSubscription,
  resumeSubscription,
} from "../../api/subscriptions";
import type { CompanySubscriptionDetail as CompanyDetailType } from "../../types/sales";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatCycle(cycle: string) {
  return cycle.charAt(0) + cycle.slice(1).toLowerCase();
}

function formatEventType(type: string) {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function CompanySubscriptionDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const { user } = useAuth();

  const [detail, setDetail] = useState<CompanyDetailType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState("");

  const canManage = user?.role === "FINANCE" || user?.role === "ADMIN";

  function load() {
    if (!customerId) return;
    getCompanySubscriptionDetail(customerId)
      .then(setDetail)
      .catch((err) =>
        setLoadError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load subscription detail."
        )
      );
  }

  useEffect(load, [customerId]);

  async function runAction(subscriptionId: string, action: () => Promise<CompanyDetailType>) {
    setActionError(null);
    setBusyId(subscriptionId);
    try {
      setDetail(await action());
    } catch (err) {
      setActionError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to update this subscription."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleChangeQuantity(subscriptionId: string) {
    const quantity = Number(qtyInput);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setActionError("Enter a valid positive quantity.");
      return;
    }
    await runAction(subscriptionId, () => changeSubscriptionQuantity(subscriptionId, quantity));
    setEditingQtyId(null);
    setQtyInput("");
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/sales/subscriptions">
          ← Back to Subscriptions
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
            {detail.customer.name} <span className="tier-badge">{detail.customer.tier}</span>
          </h1>
          <p className="page-subtitle">Subscriptions and order history</p>
        </div>
        <Link className="sales-back-link" to="/sales/subscriptions">
          ← Back to Subscriptions
        </Link>
      </div>

      {actionError && <div className="banner-error">{actionError}</div>}

      <div className="sales-card">
        <h2>Subscriptions</h2>
        {detail.subscriptions.length === 0 ? (
          <p className="sales-empty">No subscriptions for this company.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Buying Cycle</th>
                <th>Next Billing Date</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {detail.subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.product.name}</td>
                  <td>
                    {editingQtyId === sub.id ? (
                      <div className="qty-control">
                        <input
                          type="number"
                          min={1}
                          value={qtyInput}
                          onChange={(e) => setQtyInput(e.target.value)}
                          style={{ width: 64 }}
                        />
                      </div>
                    ) : (
                      sub.quantity
                    )}
                  </td>
                  <td>{formatCycle(sub.billingCycle)}</td>
                  <td>{new Date(sub.nextBillingDate).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
                  </td>
                  {canManage && (
                    <td>
                      <div className="sales-actions">
                        {sub.status === "ACTIVE" && editingQtyId !== sub.id && (
                          <>
                            <button
                              className="sales-btn"
                              disabled={busyId === sub.id}
                              onClick={() => runAction(sub.id, () => pauseSubscription(sub.id))}
                            >
                              Pause
                            </button>
                            <button
                              className="sales-btn"
                              disabled={busyId === sub.id}
                              onClick={() => {
                                setEditingQtyId(sub.id);
                                setQtyInput(String(sub.quantity));
                              }}
                            >
                              Change Qty
                            </button>
                          </>
                        )}
                        {editingQtyId === sub.id && (
                          <>
                            <button
                              className="sales-btn sales-btn-primary"
                              disabled={busyId === sub.id}
                              onClick={() => handleChangeQuantity(sub.id)}
                            >
                              Confirm
                            </button>
                            <button
                              className="sales-btn"
                              disabled={busyId === sub.id}
                              onClick={() => {
                                setEditingQtyId(null);
                                setQtyInput("");
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {sub.status === "PAUSED" && (
                          <>
                            <button
                              className="sales-btn"
                              disabled={busyId === sub.id}
                              onClick={() => runAction(sub.id, () => resumeSubscription(sub.id))}
                            >
                              Resume
                            </button>
                            <button
                              className="sales-btn sales-btn-danger"
                              disabled={busyId === sub.id}
                              onClick={() => runAction(sub.id, () => cancelSubscription(sub.id))}
                            >
                              Cancel Subscription
                            </button>
                          </>
                        )}
                        {sub.status === "ACTIVE" && editingQtyId !== sub.id && (
                          <button
                            className="sales-btn sales-btn-danger"
                            disabled={busyId === sub.id}
                            onClick={() => runAction(sub.id, () => cancelSubscription(sub.id))}
                          >
                            Cancel Subscription
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sales-card">
        <h2>One-Time Orders</h2>
        {detail.oneTimeOrders.length === 0 ? (
          <p className="sales-empty">No one-time orders yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Date</th>
                <th>Products</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.oneTimeOrders.map((order) => (
                <tr key={order.quoteId}>
                  <td>{order.quoteNumber}</td>
                  <td>{new Date(order.date).toLocaleDateString()}</td>
                  <td>{order.products}</td>
                  <td>{formatCurrency(order.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sales-card">
        <h2>Recurring Orders (Proration History)</h2>
        {detail.recurringOrders.length === 0 ? (
          <p className="sales-empty">No recurring order history yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Event</th>
                <th>Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {detail.recurringOrders.map((order) => (
                <tr key={order.id}>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{order.productName}</td>
                  <td>{formatEventType(order.type)}</td>
                  <td>
                    {order.amount === null
                      ? "—"
                      : `${order.amount < 0 ? "−" : ""}${formatCurrency(Math.abs(order.amount))}`}
                  </td>
                  <td>{order.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
