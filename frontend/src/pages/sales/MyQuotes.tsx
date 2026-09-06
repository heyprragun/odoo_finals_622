import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { listMyQuotes } from "../../api/quotes";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { Quote, QuoteStatus } from "../../types/sales";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

type ViewMode = "kanban" | "table";

// Every real QuoteStatus value maps to exactly one column: still being
// built (DRAFT), awaiting some decision or rework (SUBMITTED and every
// PENDING_*_APPROVAL stage, plus REVISION_REQUIRED - still editable/
// resubmittable, so it belongs with "in flight" rather than "done"),
// confirmed (APPROVED - the only real terminal success state today), or
// closed without success (REJECTED/CANCELLED). There is no separate
// "customer confirmed" status in this app - APPROVED already is the
// customer's own terminal "done" state (see customerPortal.service.ts's
// deriveOrderStatus) - so the fourth column covers closed-out orders
// instead of a status that doesn't exist.
type KanbanColumnKey = "DRAFT" | "PENDING" | "APPROVED" | "CLOSED";

const COLUMNS: { key: KanbanColumnKey; label: string }[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "CLOSED", label: "Closed" },
];

function columnForStatus(status: QuoteStatus): KanbanColumnKey {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
    case "CANCELLED":
      return "CLOSED";
    default:
      // SUBMITTED, PENDING_MANAGER_APPROVAL, PENDING_FINANCE_APPROVAL,
      // PENDING_ADMIN_APPROVAL, REVISION_REQUIRED
      return "PENDING";
  }
}

function getSortValue(quote: Quote, key: string): string | number | null {
  switch (key) {
    case "quoteNumber":
      return quote.quoteNumber;
    case "customer":
      return quote.customer.name;
    case "status":
      return quote.status;
    case "total":
      return quote.totalAmount;
    case "updated":
      return new Date(quote.updatedAt).getTime();
    default:
      return null;
  }
}

export function MyQuotes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSalesRep = user?.role === "SALES_REP";
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  const { filtered, filterText, setFilterText } = useTableFilter(
    quotes ?? [],
    (q) => `${q.quoteNumber} ${q.customer.name} ${q.status}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "updated", "desc");

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
          <div className="table-toolbar">
            <input
              type="text"
              placeholder="Filter by quote #, customer, or status..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          {sorted.length === 0 ? (
            <p className="sales-empty">No quotes match this filter.</p>
          ) : (
            <table className="sales-table">
              <thead>
                <tr>
                  <SortableHeader
                    label="Quote #"
                    sortKey="quoteNumber"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Customer"
                    sortKey="customer"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Total"
                    sortKey="total"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Updated"
                    sortKey="updated"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((q) => (
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
      )}
    </div>
  );
}
