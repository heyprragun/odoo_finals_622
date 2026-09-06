import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApprovalDetail } from "../../api/approvals";
import type { ApprovalDetail } from "../../types/sales";
import "./sales.css";

// Read-only history for a single quote - reused wherever a quote can be
// clicked into (Quotations → Quote Builder here, Approvals list, and the
// dedicated Audit Trail tab, which links to the same detail page this data
// also backs) so "time of approval and reason" always looks identical no
// matter which tab you got there from. Renders nothing for a quote that has
// never been submitted - there's simply no history yet, not an error.
export function QuoteAuditTrail({ quoteId }: { quoteId: string }) {
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [hasHistory, setHasHistory] = useState(true);

  useEffect(() => {
    getApprovalDetail(quoteId)
      .then(setDetail)
      .catch(() => setHasHistory(false));
  }, [quoteId]);

  if (!hasHistory) return null;
  if (!detail) return null;

  return (
    <div className="sales-card">
      <div className="sales-header" style={{ marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Audit Trail</h2>
        <Link className="sales-back-link" to={`/sales/approvals/${quoteId}`}>
          View full approval detail →
        </Link>
      </div>

      <div className="workflow-stepper" style={{ marginBottom: "1rem" }}>
        {detail.workflow.stages.map((stage, index) => (
          <div key={stage} className="workflow-step-wrapper">
            <div
              className={`workflow-step${index === detail.workflow.currentIndex ? " current" : ""}${
                index < detail.workflow.currentIndex ? " done" : ""
              }`}
            >
              {stage}
            </div>
            {index < detail.workflow.stages.length - 1 && <div className="workflow-arrow">→</div>}
          </div>
        ))}
      </div>

      {detail.auditTrail.length === 0 ? (
        <p className="sales-empty">No activity yet.</p>
      ) : (
        <table className="sales-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Time</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {detail.auditTrail.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.user}</td>
                <td>{entry.action}</td>
                <td>{new Date(entry.createdAt).toLocaleString()}</td>
                <td>{entry.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
