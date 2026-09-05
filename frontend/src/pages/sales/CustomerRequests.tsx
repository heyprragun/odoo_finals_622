import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { listCustomerRequests } from "../../api/customerRequests";
import type { CustomerRequestListItem } from "../../types/sales";
import "./sales.css";

export function CustomerRequests() {
  const [requests, setRequests] = useState<CustomerRequestListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomerRequests()
      .then(setRequests)
      .catch((err) => {
        setError(axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to load customer requests.");
      });
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Customer Requests</h1>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to dashboard
        </Link>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        {requests === null && !error && <p className="sales-empty">Loading...</p>}
        {requests !== null && requests.length === 0 && (
          <p className="sales-empty">No customer requests yet.</p>
        )}
        {requests !== null && requests.length > 0 && (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Request Date</th>
                <th>Status</th>
                <th>Items</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.customer.name} <span className="tier-badge">{r.customer.tier}</span>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge status-${r.status}`}>{r.status}</span>
                  </td>
                  <td>{r.itemCount}</td>
                  <td>
                    <Link className="sales-btn" to={`/sales/customer-requests/${r.id}`}>
                      View
                    </Link>
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
