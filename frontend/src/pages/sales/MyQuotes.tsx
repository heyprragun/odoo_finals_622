import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { listMyQuotes } from "../../api/quotes";
import type { Quote, QuoteStatus } from "../../types/sales";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

type ViewMode = "kanban" | "table";

// Only DRAFT/SUBMITTED exist today. APPROVED/CONFIRMED are future statuses
// (manager/finance approval, customer confirmation) - their columns are real
// UI, just always empty until those phases add the underlying quote states.
type KanbanColumnKey = "DRAFT" | "PENDING" | "APPROVED" | "CONFIRMED";

const COLUMNS: { key: KanbanColumnKey; label: string }[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "CONFIRMED", label: "Confirmed" },
];

function columnForStatus(status: QuoteStatus): KanbanColumnKey {
  return status === "DRAFT" ? "DRAFT" : "PENDING";
}

export function MyQuotes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSalesRep = user?.role === "SALES_REP";
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  useEffect(() => {
    listMyQuotes()
      .then(setQuotes)
      .catch((err) => {
        setError(axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to load your quotes.");
      });
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Quotations</h1>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to dashboard
        </Link>
      </div>

      <div className="sales-actions" style={{ marginBottom: "1.25rem" }}>
        {isSalesRep && (
          <button className="sales-btn sales-btn-primary" onClick={() => navigate("/sales/quotes/new")}>
            Create Quote
          </button>
        )}
        <div className="view-toggle">
          <button
            className={`view-toggle-btn${viewMode === "kanban" ? " active" : ""}`}
            onClick={() => setViewMode("kanban")}
          >
            Kanban
          </button>
          <button
            className={`view-toggle-btn${viewMode === "table" ? " active" : ""}`}
            onClick={() => setViewMode("table")}
          >
            Table
          </button>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {quotes === null && !error && (
        <div className="sales-card">
          <p className="sales-empty">Loading...</p>
        </div>
      )}

      {quotes !== null && quotes.length === 0 && (
        <div className="sales-card">
          <p className="sales-empty">You haven't created any quotes yet.</p>
        </div>
      )}

      {quotes !== null && quotes.length > 0 && viewMode === "kanban" && (
        <div className="kanban-board">
          {COLUMNS.map((column) => {
            const columnQuotes = quotes.filter((q) => columnForStatus(q.status) === column.key);
            return (
              <div className="kanban-column" key={column.key}>
                <div className="kanban-column-header">
                  <span>{column.label}</span>
                  <span className="kanban-count">{columnQuotes.length}</span>
                </div>
                <div className="kanban-column-body">
                  {columnQuotes.length === 0 && <p className="sales-empty">No quotes</p>}
                  {columnQuotes.map((q) => (
                    <Link className="kanban-card" key={q.id} to={`/sales/quotes/${q.id}`}>
                      <div className="kanban-card-title">{q.quoteNumber}</div>
                      <div className="kanban-card-customer">
                        {q.customer.name} <span className="tier-badge">{q.customer.tier}</span>
                      </div>
                      <div className="kanban-card-total">{formatCurrency(q.totalAmount)}</div>
                      <div className="warehouse-line">{new Date(q.updatedAt).toLocaleDateString()}</div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {quotes !== null && quotes.length > 0 && viewMode === "table" && (
        <div className="sales-card">
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
        </div>
      )}
    </div>
  );
}
