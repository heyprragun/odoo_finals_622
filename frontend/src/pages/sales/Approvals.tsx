import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { listApprovals } from "../../api/approvals";
import { useSortableTable } from "../../hooks/useSortableTable";
import { SortableHeader } from "../../components/SortableHeader";
import type { ApprovalListItem, ApprovalSummary } from "../../types/sales";
import "./sales.css";

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
    case "assignedTo":
      return item.assignedTo ?? "";
    default:
      return null;
  }
}

function ApprovalsTable({
  items,
  emptyMessage,
  onRowClick,
}: {
  items: ApprovalListItem[];
  emptyMessage: string;
  onRowClick: (id: string) => void;
}) {
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(items, getSortValue, "customer");

  if (items.length === 0) {
    return <p className="sales-empty">{emptyMessage}</p>;
  }
  return (
    <table className="sales-table">
      <thead>
        <tr>
          <SortableHeader label="Quotation" sortKey="quoteNumber" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
          <SortableHeader label="Customer" sortKey="customer" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
          <SortableHeader label="Blended Risk" sortKey="risk" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
          <SortableHeader label="Stage" sortKey="stage" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
          <SortableHeader label="Assigned To" sortKey="assignedTo" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((item) => (
          <tr key={item.id} className="clickable-row" onClick={() => onRowClick(item.id)}>
            <td>{item.quoteNumber}</td>
            <td>
              {item.customer.name} <span className="tier-badge">{item.customer.tier}</span>
            </td>
            <td>
              {item.riskLevel && <span className={`risk-badge risk-${item.riskLevel}`}>{item.riskLevel}</span>}
            </td>
            <td>{item.stageLabel}</td>
            <td>{item.assignedTo ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Approvals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user?.role === "MANAGER";
  const isFinance = user?.role === "FINANCE";
  const isAdmin = user?.role === "ADMIN";

  const [summary, setSummary] = useState<ApprovalSummary | null>(null);
  const [items, setItems] = useState<ApprovalListItem[] | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manager's, Finance's and Admin's own lists are always the full set,
  // split into two tables below - the "Pending Only" toggle only applies to
  // the single-table view other roles get.
  const effectivePendingOnly = isManager || isFinance || isAdmin ? false : pendingOnly;

  useEffect(() => {
    setItems(null);
    setError(null);
    listApprovals(effectivePendingOnly)
      .then((data) => {
        setSummary(data.summary);
        setItems(data.items);
      })
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load approvals."
        );
      });
  }, [effectivePendingOnly]);

  function goToDetail(id: string) {
    navigate(`/sales/approvals/${id}`);
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Approvals (List)</h1>
          <p className="page-subtitle">
            Every quotation that needed, needs, or is going through discount approval
          </p>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-summary-grid">
        <div className="sales-stat">
          <div className="value">{summary?.pending ?? "–"}</div>
          <div className="label">Pending</div>
        </div>
        <div className="sales-stat">
          <div className="value">{summary?.returned ?? "–"}</div>
          <div className="label">Returned</div>
        </div>
        <div className="sales-stat">
          <div className="value">{summary?.approved ?? "–"}</div>
          <div className="label">Approved</div>
        </div>
      </div>

      {items === null && !error && (
        <div className="sales-card">
          <p className="sales-empty">Loading...</p>
        </div>
      )}

      {items !== null && isManager && (
        <>
          <div className="sales-card">
            <h2>Requires Your Approval</h2>
            <ApprovalsTable
              items={items.filter((i) => i.status === "PENDING_MANAGER_APPROVAL")}
              emptyMessage="Nothing is waiting on you right now."
              onRowClick={goToDetail}
            />
          </div>
          <div className="sales-card">
            <h2>Other Quotations</h2>
            <ApprovalsTable
              items={items.filter((i) => i.status !== "PENDING_MANAGER_APPROVAL")}
              emptyMessage="No other quotations yet."
              onRowClick={goToDetail}
            />
          </div>
        </>
      )}

      {items !== null && isFinance && (
        <>
          {/* Finance only ever deals with HIGH risk - MEDIUM/LOW never reach
              this stage (see quote.service.ts's routing), but the filter is
              kept explicit here too as a belt-and-braces display rule. */}
          <div className="sales-card">
            <h2>Requires Your Approval</h2>
            <ApprovalsTable
              items={items.filter((i) => i.riskLevel === "HIGH" && i.status === "PENDING_FINANCE_APPROVAL")}
              emptyMessage="Nothing is waiting on you right now."
              onRowClick={goToDetail}
            />
          </div>
          <div className="sales-card">
            <h2>Other Quotations</h2>
            <ApprovalsTable
              items={items.filter((i) => i.riskLevel === "HIGH" && i.status !== "PENDING_FINANCE_APPROVAL")}
              emptyMessage="No other high-risk quotations yet."
              onRowClick={goToDetail}
            />
          </div>
        </>
      )}

      {items !== null && isAdmin && (
        <>
          {/* Admin is the master-approval gate for every quote regardless of
              risk level, so unlike Finance this isn't filtered by risk. */}
          <div className="sales-card">
            <h2>Requires Your Approval</h2>
            <ApprovalsTable
              items={items.filter((i) => i.status === "PENDING_ADMIN_APPROVAL")}
              emptyMessage="Nothing is waiting on you right now."
              onRowClick={goToDetail}
            />
          </div>
          <div className="sales-card">
            <h2>Other Quotations</h2>
            <ApprovalsTable
              items={items.filter((i) => i.status !== "PENDING_ADMIN_APPROVAL")}
              emptyMessage="No other quotations yet."
              onRowClick={goToDetail}
            />
          </div>
        </>
      )}

      {items !== null && !isManager && !isFinance && !isAdmin && (
        <>
          <div className="sales-actions" style={{ marginBottom: "1.25rem" }}>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
              />
              Pending Only
            </label>
          </div>
          <div className="sales-card">
            <ApprovalsTable items={items} emptyMessage="No quotations found." onRowClick={goToDetail} />
          </div>
        </>
      )}
    </div>
  );
}
