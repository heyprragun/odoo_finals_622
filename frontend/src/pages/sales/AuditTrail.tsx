import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { listApprovals } from "../../api/approvals";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { ApprovalListItem } from "../../types/sales";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function getSortValue(item: ApprovalListItem, key: string): string | number | null {
  switch (key) {
    case "quoteNumber":
      return item.quoteNumber;
    case "customer":
      return item.customer.name;
    case "risk":
      return item.riskLevel ?? "";
    case "stage":
      return item.stageLabel;
    case "total":
      return item.totalAmount;
    case "updated":
      return new Date(item.updatedAt).getTime();
    default:
      return null;
  }
}

// Pure read-only history of every quotation that has gone under review -
// not action-oriented like the Approvals tab (no approve/return/reject
// buttons live here). Clicking a row reuses the exact same detail page
// Approvals and Quotations link to, so the audit trail (who acted, when,
// and why) is identical no matter which tab you got there from.
export function AuditTrail() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ApprovalListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { filtered, filterText, setFilterText } = useTableFilter(
    items ?? [],
    (item) => `${item.quoteNumber} ${item.customer.name} ${item.stageLabel}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "updated", "desc");

  useEffect(() => {
    listApprovals(false)
      .then((data) => setItems(data.items))
      .catch((err) => setError(errorMessage(err, "Failed to load audit trail.")));
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Audit Trail</h1>
          <p className="page-subtitle">
            Every order that has gone under review, with who acted on it, when, and why
          </p>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        {items === null && !error && <p className="sales-empty">Loading...</p>}
        {items !== null && items.length === 0 && (
          <p className="sales-empty">No orders have gone under review yet.</p>
        )}
        {items !== null && items.length > 0 && (
          <>
            <div className="table-toolbar">
              <input
                type="text"
                placeholder="Filter by quote #, customer, or stage..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            {sorted.length === 0 ? (
              <p className="sales-empty">No orders match this filter.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Quotation" sortKey="quoteNumber" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Customer" sortKey="customer" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Blended Risk" sortKey="risk" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Stage" sortKey="stage" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Total" sortKey="total" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Last Updated" sortKey="updated" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr
                      key={item.id}
                      className="clickable-row"
                      onClick={() => navigate(`/sales/approvals/${item.id}`)}
                    >
                      <td>{item.quoteNumber}</td>
                      <td>
                        {item.customer.name} <span className="tier-badge">{item.customer.tier}</span>
                      </td>
                      <td>
                        {item.riskLevel && <span className={`risk-badge risk-${item.riskLevel}`}>{item.riskLevel}</span>}
                      </td>
                      <td>{item.stageLabel}</td>
                      <td>{formatCurrency(item.totalAmount)}</td>
                      <td>{new Date(item.updatedAt).toLocaleString()}</td>
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
