import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { listMySubscriptions } from "../../api/customerPortal";
import { useSortableTable } from "../../hooks/useSortableTable";
import { SortableHeader } from "../../components/SortableHeader";
import type { CustomerSubscriptionItem } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function getSortValue(sub: CustomerSubscriptionItem, key: string): string | number | null {
  switch (key) {
    case "product":
      return sub.productName;
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

export function CustomerSubscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<CustomerSubscriptionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(subscriptions ?? [], getSortValue, "product");

  useEffect(() => {
    listMySubscriptions()
      .then(setSubscriptions)
      .catch((err) => setError(errorMessage(err, "Failed to load your subscriptions.")));
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Subscriptions</h1>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        <h2>Your Subscriptions</h2>
        {subscriptions === null ? (
          <p className="sales-empty">Loading...</p>
        ) : subscriptions.length === 0 ? (
          <p className="sales-empty">You have no subscriptions yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <SortableHeader label="Product" sortKey="product" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Quantity" sortKey="quantity" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Billing Cycle" sortKey="cycle" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Next Billing Date" sortKey="nextBilling" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((sub) => (
                <tr
                  key={sub.id}
                  className="clickable-row"
                  onClick={() => navigate(`/portal/subscriptions/${sub.id}`)}
                >
                  <td>{sub.productName}</td>
                  <td>{sub.quantity}</td>
                  <td>{sub.billingCycle}</td>
                  <td>{new Date(sub.nextBillingDate).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
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
