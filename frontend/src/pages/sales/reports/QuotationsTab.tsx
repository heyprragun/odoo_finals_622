import { useEffect, useState } from "react";
import axios from "axios";
import { getOrdersOverview } from "../../../api/reports";
import { useSortableTable } from "../../../hooks/useSortableTable";
import { SortableHeader } from "../../../components/SortableHeader";
import type { QuotationBucket, QuotationOverviewItem, QuotationsOverviewResponse } from "../../../types/sales";
import "../sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getSortValue(item: QuotationOverviewItem, key: string): string | number | null {
  switch (key) {
    case "quoteNumber":
      return item.quoteNumber;
    case "customer":
      return item.customerName;
    case "salesRep":
      return item.salesRepName;
    case "status":
      return item.status;
    case "amount":
      return item.totalAmount;
    case "created":
      return new Date(item.createdAt).getTime();
    default:
      return null;
  }
}

const BUCKET_LABELS: Record<QuotationBucket, string> = {
  PENDING_MANAGER: "Pending - Manager",
  PENDING_FINANCE: "Pending - Finance",
  PENDING_ADMIN: "Pending - Admin",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  DRAFT_OR_REVISION: "Draft / Revision",
};

const PERIOD_PRESETS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "All Time", days: null },
] as const;

export function QuotationsTab() {
  const [data, setData] = useState<QuotationsOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bucket, setBucket] = useState<QuotationBucket | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load() {
    getOrdersOverview({ from: from || undefined, to: to || undefined, bucket: bucket || undefined })
      .then(setData)
      .catch((err) => setError(errorMessage(err, "Failed to load quotations.")));
  }

  useEffect(load, [bucket, from, to]);

  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(
    data?.items ?? [],
    getSortValue,
    "created",
    "desc"
  );

  function applyPreset(days: number | null) {
    if (days === null) {
      setFrom("");
      setTo("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }

  if (error) return <div className="banner-error">{error}</div>;

  return (
    <>
      <div className="sales-card">
        <h2>Quotations Overview</h2>
        {data === null ? (
          <p className="sales-empty">Loading...</p>
        ) : (
          <div className="sales-summary-grid">
            <div className="sales-stat">
              <div className="value">{data.summary.pendingManager}</div>
              <div className="label">Pending - Manager</div>
            </div>
            <div className="sales-stat">
              <div className="value">{data.summary.pendingFinance}</div>
              <div className="label">Pending - Finance</div>
            </div>
            <div className="sales-stat">
              <div className="value">{data.summary.pendingAdmin}</div>
              <div className="label">Pending - Admin</div>
            </div>
            <div className="sales-stat">
              <div className="value">{data.summary.approved}</div>
              <div className="label">Approved</div>
            </div>
            <div className="sales-stat">
              <div className="value">{data.summary.rejected}</div>
              <div className="label">Rejected</div>
            </div>
          </div>
        )}
      </div>

      <div className="sales-card">
        <h2>Filters</h2>
        <div className="product-search-row">
          {PERIOD_PRESETS.map((preset) => (
            <button key={preset.label} className="sales-btn" onClick={() => applyPreset(preset.days)}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="product-search-row">
          <label>
            From: <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To: <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select value={bucket} onChange={(e) => setBucket(e.target.value as QuotationBucket | "")}>
            <option value="">All Statuses</option>
            {(Object.keys(BUCKET_LABELS) as QuotationBucket[]).map((b) => (
              <option key={b} value={b}>
                {BUCKET_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sales-card">
        <h2>Matching Quotations</h2>
        {data === null ? (
          <p className="sales-empty">Loading...</p>
        ) : data.items.length === 0 ? (
          <p className="sales-empty">No quotations match these filters.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <SortableHeader label="Quote #" sortKey="quoteNumber" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Customer" sortKey="customer" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Sales Rep" sortKey="salesRep" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Amount" sortKey="amount" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <th>Items</th>
                <SortableHeader label="Created" sortKey="created" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.id}>
                  <td>{item.quoteNumber}</td>
                  <td>{item.customerName}</td>
                  <td>{item.salesRepName}</td>
                  <td>
                    <span className={`status-badge status-${item.status}`}>{item.status}</span>
                  </td>
                  <td>{formatCurrency(item.totalAmount)}</td>
                  <td>{item.itemSummary}</td>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
