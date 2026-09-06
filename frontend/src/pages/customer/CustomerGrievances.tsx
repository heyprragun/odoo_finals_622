import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { listMyDeliveredOrders } from "../../api/customerPortal";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { DeliveredOrder } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function itemsSummary(order: DeliveredOrder) {
  return order.items.map((i) => `${i.productName} x${i.quantity}`).join(", ");
}

function getSortValue(order: DeliveredOrder, key: string): string | number | null {
  switch (key) {
    case "quoteNumber":
      return order.quoteNumber;
    case "items":
      return itemsSummary(order);
    case "amount":
      return order.totalAmount;
    case "approvedAt":
      return new Date(order.approvedAt).getTime();
    case "grievance":
      return order.grievance?.status ?? "";
    default:
      return null;
  }
}

export function CustomerGrievances() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<DeliveredOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { filtered, filterText, setFilterText } = useTableFilter(orders ?? [], (o) => `${o.quoteNumber} ${itemsSummary(o)}`);
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "approvedAt", "desc");

  useEffect(() => {
    listMyDeliveredOrders()
      .then(setOrders)
      .catch((err) => setError(errorMessage(err, "Failed to load your delivered orders.")));
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Grievances</h1>
      </div>
      <p className="page-subtitle" style={{ marginTop: "-1rem", marginBottom: "1.5rem" }}>
        Click a delivered order below to raise a grievance about it, or continue an existing one.
      </p>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        {orders === null && !error && <p className="sales-empty">Loading...</p>}
        {orders !== null && orders.length === 0 && (
          <p className="sales-empty">No delivered orders yet - grievances can only be raised once an order is delivered.</p>
        )}
        {orders !== null && orders.length > 0 && (
          <>
            <div className="table-toolbar">
              <input
                type="text"
                placeholder="Filter by order number or item..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            <table className="sales-table">
              <thead>
                <tr>
                  <SortableHeader label="Order" sortKey="quoteNumber" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Items" sortKey="items" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Amount" sortKey="amount" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Delivered" sortKey="approvedAt" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Grievance" sortKey="grievance" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => (
                  <tr
                    key={order.quoteId}
                    className="clickable-row"
                    onClick={() =>
                      navigate(`/portal/grievances/${order.quoteId}`, {
                        state: { quoteNumber: order.quoteNumber, totalAmount: order.totalAmount, items: order.items },
                      })
                    }
                  >
                    <td>{order.quoteNumber}</td>
                    <td>{itemsSummary(order)}</td>
                    <td>{formatCurrency(order.totalAmount)}</td>
                    <td>{new Date(order.approvedAt).toLocaleDateString()}</td>
                    <td>
                      {order.grievance ? (
                        <span className={`status-badge status-${order.grievance.status}`}>
                          {order.grievance.status}
                        </span>
                      ) : (
                        <span className="sales-btn">Raise Grievance</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
