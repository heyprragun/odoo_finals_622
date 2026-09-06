import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { listMyOrders } from "../../api/customerPortal";
import { useSortableTable } from "../../hooks/useSortableTable";
import { SortableHeader } from "../../components/SortableHeader";
import type { CustomerOrder, CustomerOrderStatus } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

const STATUS_LABELS: Record<CustomerOrderStatus, string> = {
  IN_PROGRESS: "In Progress",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

function getSortValue(order: CustomerOrder, key: string): string | number | null {
  switch (key) {
    case "date":
      return new Date(order.createdAt).getTime();
    case "discount":
      return order.expectedDiscountPercentage;
    case "quote":
      return order.quote?.quoteNumber ?? "";
    case "status":
      return order.status;
    default:
      return null;
  }
}

// "Sent orders" here are the customer's own CustomerRequests. Status is
// collapsed to three values - APPROVED only once the linked quote has
// cleared every approval stage including Admin's, CANCELLED once the
// customer withdraws it, IN_PROGRESS for everything else (still mid-chain,
// returned, or even rejected - all of which the customer can still act on
// via the Negotiations tab). Rows are clickable through to order detail.
export function CustomerDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(orders ?? [], getSortValue, "date", "desc");

  useEffect(() => {
    listMyOrders()
      .then(setOrders)
      .catch((err) => setError(errorMessage(err, "Failed to load your orders.")));
  }, []);

  const approvedCount = orders?.filter((o) => o.status === "APPROVED").length ?? 0;
  const inProgressCount = orders?.filter((o) => o.status === "IN_PROGRESS").length ?? 0;

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Dashboard</h1>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-summary-grid">
        <div className="sales-stat">
          <div className="value">{orders === null ? "–" : inProgressCount}</div>
          <div className="label">In Progress</div>
        </div>
        <div className="sales-stat">
          <div className="value">{orders === null ? "–" : approvedCount}</div>
          <div className="label">Approved</div>
        </div>
      </div>

      <div className="sales-card">
        <h2>Your Orders</h2>
        {orders === null ? (
          <p className="sales-empty">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="sales-empty">You haven't sent any requests yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <SortableHeader label="Date" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <th>Products</th>
                <SortableHeader label="Expected Discount" sortKey="discount" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Quote" sortKey="quote" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <th>Updates</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((order) => (
                <tr
                  key={order.id}
                  className="clickable-row"
                  onClick={() => navigate(`/portal/orders/${order.id}`)}
                >
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{order.items.map((item) => `${item.productName} (x${item.quantity})`).join(", ")}</td>
                  <td>{order.expectedDiscountPercentage !== null ? `${order.expectedDiscountPercentage}%` : "—"}</td>
                  <td>{order.quote ? order.quote.quoteNumber : "—"}</td>
                  <td>
                    <span className={`status-badge status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
                  </td>
                  <td>
                    {order.pendingRecommendationCount > 0 ? (
                      <span className="notification-badge">
                        {order.pendingRecommendationCount} new recommendation
                        {order.pendingRecommendationCount > 1 ? "s" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
