import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { listSubscriptions } from "../../api/subscriptions";
import type { SubscriptionListItem, SubscriptionsSummary } from "../../types/sales";
import "./sales.css";

function formatCycle(cycle: string) {
  return cycle.charAt(0) + cycle.slice(1).toLowerCase();
}

export function Subscriptions() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SubscriptionsSummary | null>(null);
  const [items, setItems] = useState<SubscriptionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSubscriptions()
      .then((data) => {
        setSummary(data.summary);
        setItems(data.items);
      })
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load subscriptions."
        );
      });
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Subscriptions</h1>
          <p className="page-subtitle">Recurring subscriptions across every company, live from billing state</p>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-summary-grid">
        <div className="sales-stat">
          <div className="value">{summary?.active ?? "–"}</div>
          <div className="label">Active</div>
        </div>
        <div className="sales-stat">
          <div className="value">{summary?.paused ?? "–"}</div>
          <div className="label">Paused</div>
        </div>
        <div className="sales-stat">
          <div className="value">{summary?.cancelled ?? "–"}</div>
          <div className="label">Cancelled</div>
        </div>
      </div>

      <div className="sales-card">
        {items === null && !error && <p className="sales-empty">Loading...</p>}
        {items !== null && items.length === 0 && <p className="sales-empty">No subscriptions yet.</p>}
        {items !== null && items.length > 0 && (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Product</th>
                <th>Buying Cycle</th>
                <th>Next Billing Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="clickable-row"
                  onClick={() => navigate(`/sales/subscriptions/${item.customer.id}`)}
                >
                  <td>
                    {item.customer.name} <span className="tier-badge">{item.customer.tier}</span>
                  </td>
                  <td>
                    {item.product.name} (x{item.quantity})
                  </td>
                  <td>{formatCycle(item.billingCycle)}</td>
                  <td>{new Date(item.nextBillingDate).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge status-${item.status}`}>{item.status}</span>
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
