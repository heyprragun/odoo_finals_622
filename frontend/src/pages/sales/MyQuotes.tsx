import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { listMyQuotes } from "../../api/quotes";
import type { Quote } from "../../types/sales";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function MyQuotes() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyQuotes()
      .then(setQuotes)
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load your quotes."
        );
      });
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>My Quotes</h1>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to dashboard
        </Link>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        {quotes === null && !error && <p className="sales-empty">Loading...</p>}
        {quotes !== null && quotes.length === 0 && (
          <p className="sales-empty">You haven't created any quotes yet.</p>
        )}
        {quotes !== null && quotes.length > 0 && (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>{q.quoteNumber}</td>
                  <td>
                    {q.customer.name} <span className="tier-badge">{q.customer.tier}</span>
                  </td>
                  <td>
                    <span className={`status-badge status-${q.status}`}>{q.status}</span>
                  </td>
                  <td>{formatCurrency(q.totalAmount)}</td>
                  <td>{new Date(q.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <Link className="sales-btn" to={`/sales/quotes/${q.id}`}>
                      {q.status === "DRAFT" ? "Edit" : "View"}
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
