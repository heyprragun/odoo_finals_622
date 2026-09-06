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
import { decideTierChangeRequest, listTierChangeRequests } from "../../api/customerTierChange";
import { useSortableTable } from "../../hooks/useSortableTable";
import { SortableHeader } from "../../components/SortableHeader";
import type {
  CompanySubscriptionDetail as CompanyDetailType,
  OneTimeOrder,
  PendingTierChangeRequest,
  RecurringOrder,
  SubscriptionListItem,
} from "../../types/sales";
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

function getSubscriptionSortValue(sub: SubscriptionListItem, key: string): string | number | null {
  switch (key) {
    case "product":
      return sub.product.name;
    case "quantity":
      return sub.quantity;
    case "cycle":
      return sub.billingCycle;
    case "nextBilling":
      return new Date(sub.nextBillingDate).getTime();
    case "status":
      return sub.status;
    default:
      return null;
  }
}

function getOneTimeOrderSortValue(order: OneTimeOrder, key: string): string | number | null {
  switch (key) {
    case "quoteNumber":
      return order.quoteNumber;
    case "date":
      return new Date(order.date).getTime();
    case "products":
      return order.products;
    case "amount":
      return order.amount;
    default:
      return null;
  }
}

function getRecurringOrderSortValue(order: RecurringOrder, key: string): string | number | null {
  switch (key) {
    case "date":
      return new Date(order.createdAt).getTime();
    case "product":
      return order.productName;
    case "event":
      return order.type;
    case "amount":
      return order.amount;
    default:
      return null;
  }
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
  const [tierRequests, setTierRequests] = useState<PendingTierChangeRequest[] | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const canManage = user?.role === "FINANCE" || user?.role === "ADMIN";
  const isAdmin = user?.role === "ADMIN";

  const subsSort = useSortableTable(detail?.subscriptions ?? [], getSubscriptionSortValue, "product");
  const oneTimeSort = useSortableTable(detail?.oneTimeOrders ?? [], getOneTimeOrderSortValue, "date", "desc");
  const recurringSort = useSortableTable(detail?.recurringOrders ?? [], getRecurringOrderSortValue, "date", "desc");

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

  function loadTierRequests() {
    if (!isAdmin || !customerId) return;
    listTierChangeRequests()
      .then((all) => setTierRequests(all.filter((r) => r.customer.id === customerId)))
      .catch(() => setTierRequests([]));
  }

  useEffect(load, [customerId]);
  useEffect(loadTierRequests, [customerId, isAdmin]);

  async function handleDecide(requestId: string, decision: "APPROVE" | "REJECT") {
    setActionError(null);
    setDecidingId(requestId);
    try {
      await decideTierChangeRequest(requestId, decision);
      loadTierRequests();
      load();
    } catch (err) {
      setActionError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to decide this request."
      );
    } finally {
      setDecidingId(null);
    }
  }

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
                <SortableHeader label="Product" sortKey="product" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                <SortableHeader label="Quantity" sortKey="quantity" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                <SortableHeader label="Buying Cycle" sortKey="cycle" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                <SortableHeader label="Next Billing Date" sortKey="nextBilling" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                <SortableHeader label="Status" sortKey="status" activeKey={subsSort.sortKey} direction={subsSort.sortDirection} onSort={subsSort.toggleSort} />
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {subsSort.sorted.map((sub) => (
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

      {isAdmin && (
        <div className="sales-card">
          <h2>Pending Plan Tier Change Requests</h2>
          {tierRequests === null ? (
            <p className="sales-empty">Loading...</p>
          ) : tierRequests.length === 0 ? (
            <p className="sales-empty">No pending requests for this company.</p>
          ) : (
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Current Tier</th>
                  <th>Requested Tier</th>
                  <th>Type</th>
                  <th>Customer Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tierRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <span className="tier-badge">{req.customer.currentTier}</span>
                    </td>
                    <td>
                      <span className="tier-badge">{req.requestedTier}</span>
                    </td>
                    <td>{req.type}</td>
                    <td>{req.customerNote ?? "—"}</td>
                    <td>
                      <div className="sales-actions">
                        <button
                          className="sales-btn sales-btn-primary"
                          disabled={decidingId === req.id}
                          onClick={() => handleDecide(req.id, "APPROVE")}
                        >
                          Approve
                        </button>
                        <button
                          className="sales-btn sales-btn-danger"
                          disabled={decidingId === req.id}
                          onClick={() => handleDecide(req.id, "REJECT")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="sales-card">
        <h2>One-Time Orders</h2>
        {detail.oneTimeOrders.length === 0 ? (
          <p className="sales-empty">No one-time orders yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <SortableHeader label="Quote #" sortKey="quoteNumber" activeKey={oneTimeSort.sortKey} direction={oneTimeSort.sortDirection} onSort={oneTimeSort.toggleSort} />
                <SortableHeader label="Date" sortKey="date" activeKey={oneTimeSort.sortKey} direction={oneTimeSort.sortDirection} onSort={oneTimeSort.toggleSort} />
                <SortableHeader label="Products" sortKey="products" activeKey={oneTimeSort.sortKey} direction={oneTimeSort.sortDirection} onSort={oneTimeSort.toggleSort} />
                <SortableHeader label="Amount" sortKey="amount" activeKey={oneTimeSort.sortKey} direction={oneTimeSort.sortDirection} onSort={oneTimeSort.toggleSort} />
              </tr>
            </thead>
            <tbody>
              {oneTimeSort.sorted.map((order) => (
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
                <SortableHeader label="Date" sortKey="date" activeKey={recurringSort.sortKey} direction={recurringSort.sortDirection} onSort={recurringSort.toggleSort} />
                <SortableHeader label="Product" sortKey="product" activeKey={recurringSort.sortKey} direction={recurringSort.sortDirection} onSort={recurringSort.toggleSort} />
                <SortableHeader label="Event" sortKey="event" activeKey={recurringSort.sortKey} direction={recurringSort.sortDirection} onSort={recurringSort.toggleSort} />
                <SortableHeader label="Amount" sortKey="amount" activeKey={recurringSort.sortKey} direction={recurringSort.sortDirection} onSort={recurringSort.toggleSort} />
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {recurringSort.sorted.map((order) => (
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
