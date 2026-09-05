import { useEffect, useState } from "react";
import axios from "axios";
import { listMySubscriptions } from "../../api/customerPortal";
import type { CustomerSubscriptionItem } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

export function CustomerSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<CustomerSubscriptionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <h2>Active Subscriptions</h2>
        {subscriptions === null ? (
          <p className="sales-empty">Loading...</p>
        ) : subscriptions.length === 0 ? (
          <p className="sales-empty">You have no active subscriptions.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Billing Cycle</th>
                <th>Next Billing Date</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.productName}</td>
                  <td>{sub.quantity}</td>
                  <td>{sub.billingCycle}</td>
                  <td>{new Date(sub.nextBillingDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
