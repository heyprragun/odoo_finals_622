import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { listInvoices } from "../../api/invoices";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { InvoiceListItem, InvoicesSummary } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getSortValue(item: InvoiceListItem, key: string): string | number | null {
  switch (key) {
    case "invoiceNumber":
      return item.invoiceNumber;
    case "customer":
      return item.customer.name;
    case "amount":
      return item.amount;
    case "status":
      return item.status;
    case "dueDate":
      return new Date(item.dueDate).getTime();
    default:
      return null;
  }
}

export function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAllowed = user?.role === "FINANCE" || user?.role === "ADMIN";

  const [summary, setSummary] = useState<InvoicesSummary | null>(null);
  const [items, setItems] = useState<InvoiceListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { filtered, filterText, setFilterText } = useTableFilter(
    items ?? [],
    (item) => `${item.invoiceNumber} ${item.customer.name} ${item.status}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "dueDate");

  useEffect(() => {
    if (!isAllowed) return;
    listInvoices()
      .then((data) => {
        setSummary(data.summary);
        setItems(data.items);
      })
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load invoices."
        );
      });
  }, [isAllowed]);

  if (!isAllowed) {
    return <NoAccessBlock title="Invoices" />;
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Invoices</h1>
          <p className="page-subtitle">One-time and recurring invoices across every customer</p>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-summary-grid">
        <div className="sales-stat">
          <div className="value">{summary?.paid ?? "–"}</div>
          <div className="label">Paid</div>
        </div>
        <div className="sales-stat">
          <div className="value">{summary?.unpaid ?? "–"}</div>
          <div className="label">Unpaid</div>
        </div>
      </div>

      <div className="sales-card">
        {items === null && !error && <p className="sales-empty">Loading...</p>}
        {items !== null && items.length === 0 && <p className="sales-empty">No invoices yet.</p>}
        {items !== null && items.length > 0 && (
          <>
            <div className="table-toolbar">
              <input
                type="text"
                placeholder="Filter by invoice #, customer, or status..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            {sorted.length === 0 ? (
              <p className="sales-empty">No invoices match this filter.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Invoice #" sortKey="invoiceNumber" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Customer" sortKey="customer" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Amount" sortKey="amount" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Due Date" sortKey="dueDate" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr
                      key={item.id}
                      className="clickable-row"
                      onClick={() => navigate(`/sales/invoices/${item.id}`)}
                    >
                      <td>{item.invoiceNumber}</td>
                      <td>
                        {item.customer.name} <span className="tier-badge">{item.customer.tier}</span>
                      </td>
                      <td>{formatCurrency(item.amount)}</td>
                      <td>
                        <span className={`status-badge status-${item.status}`}>{item.status}</span>
                      </td>
                      <td>{new Date(item.dueDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
