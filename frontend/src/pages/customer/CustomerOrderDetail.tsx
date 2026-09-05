import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { cancelMyOrder, getMyOrder } from "../../api/customerPortal";
import { CustomerRecommendations } from "./CustomerRecommendations";
import type { CustomerOrderDetail as CustomerOrderDetailType } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const STATUS_LABELS = { IN_PROGRESS: "In Progress", APPROVED: "Approved", CANCELLED: "Cancelled" } as const;

export function CustomerOrderDetail() {
  const { id } = useParams<{ id: string }>();

  const [order, setOrder] = useState<CustomerOrderDetailType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    getMyOrder(id)
      .then(setOrder)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load this order.")));
  }, [id]);

  function reload() {
    if (!id) return;
    getMyOrder(id)
      .then(setOrder)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load this order.")));
  }

  async function handleCancel() {
    if (!id) return;
    setActionError(null);
    setIsCancelling(true);
    try {
      const updated = await cancelMyOrder(id, reason.trim() || undefined);
      setOrder(updated);
      setShowCancelForm(false);
    } catch (err) {
      setActionError(errorMessage(err, "Failed to cancel this order."));
    } finally {
      setIsCancelling(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!order) {
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
          <h1>Order Detail</h1>
          <p className="page-subtitle">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
        </div>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to dashboard
        </Link>
      </div>

      <div className="approval-badges">
        <span className={`status-badge status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
        {order.quote && <span className="tier-badge">Quote {order.quote.quoteNumber}</span>}
      </div>

      {actionError && <div className="banner-error">{actionError}</div>}

      <div className="sales-card">
        <h2>Products</h2>
        <table className="sales-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Unit Price</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index}>
                <td>{item.productName}</td>
                <td>{item.sku}</td>
                <td>{formatCurrency(item.unitPrice)}</td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sales-card">
        <h2>Details</h2>
        <div className="quote-summary-row">
          <span>Expected Discount</span>
          <span>{order.expectedDiscountPercentage !== null ? `${order.expectedDiscountPercentage}%` : "—"}</span>
        </div>
        <div className="quote-summary-row">
          <span>Comments</span>
          <span>{order.notes ?? "—"}</span>
        </div>
      </div>

      <CustomerRecommendations recommendations={order.recommendations} onActioned={reload} />

      {order.cancellable && (
        <div className="sales-card">
          <h2>Cancel Order</h2>
          {!showCancelForm ? (
            <div className="sales-actions">
              <button className="sales-btn sales-btn-danger" onClick={() => setShowCancelForm(true)}>
                Cancel Order
              </button>
            </div>
          ) : (
            <>
              <textarea
                placeholder="Optional reason for cancelling..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
                    setReason("");
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
