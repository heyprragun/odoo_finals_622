import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { listApprovals } from "../../api/approvals";
import type { ApprovalListItem, ApprovalSummary } from "../../types/sales";
import "./sales.css";

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

  function renderTable(list: ApprovalListItem[], emptyMessage: string) {
    if (list.length === 0) {
      return <p className="sales-empty">{emptyMessage}</p>;
    }
    return (
      <table className="sales-table">
        <thead>
          <tr>
            <th>Quotation</th>
            <th>Customer</th>
            <th>Blended Risk</th>
            <th>Stage</th>
            <th>Assigned To</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item) => (
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
              <td>{item.assignedTo ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
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
            {renderTable(
              items.filter((i) => i.status === "PENDING_MANAGER_APPROVAL"),
              "Nothing is waiting on you right now."
            )}
          </div>
          <div className="sales-card">
            <h2>Other Quotations</h2>
            {renderTable(
              items.filter((i) => i.status !== "PENDING_MANAGER_APPROVAL"),
              "No other quotations yet."
            )}
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
            {renderTable(
              items.filter((i) => i.riskLevel === "HIGH" && i.status === "PENDING_FINANCE_APPROVAL"),
              "Nothing is waiting on you right now."
            )}
          </div>
          <div className="sales-card">
            <h2>Other Quotations</h2>
            {renderTable(
              items.filter((i) => i.riskLevel === "HIGH" && i.status !== "PENDING_FINANCE_APPROVAL"),
              "No other high-risk quotations yet."
            )}
          </div>
        </>
      )}

      {items !== null && isAdmin && (
        <>
          {/* Admin is the master-approval gate for every quote regardless of
              risk level, so unlike Finance this isn't filtered by risk. */}
          <div className="sales-card">
            <h2>Requires Your Approval</h2>
            {renderTable(
              items.filter((i) => i.status === "PENDING_ADMIN_APPROVAL"),
              "Nothing is waiting on you right now."
            )}
          </div>
          <div className="sales-card">
            <h2>Other Quotations</h2>
            {renderTable(
              items.filter((i) => i.status !== "PENDING_ADMIN_APPROVAL"),
              "No other quotations yet."
            )}
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
          <div className="sales-card">{renderTable(items, "No quotations found.")}</div>
        </>
      )}
    </div>
  );
}
