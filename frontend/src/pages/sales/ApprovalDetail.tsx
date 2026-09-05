import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import {
  approveQuoteApproval,
  getApprovalDetail,
  rejectQuoteApproval,
  returnQuoteForRevision,
} from "../../api/approvals";
import type { ApprovalDetail as ApprovalDetailType } from "../../types/sales";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

type PendingAction = "return" | "reject" | null;

export function ApprovalDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [detail, setDetail] = useState<ApprovalDetailType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!id) return;
    getApprovalDetail(id)
      .then(setDetail)
      .catch((err) =>
        setLoadError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load approval detail."
        )
      );
  }, [id]);

  // Frontend hint only - the backend re-validates role + current stage on
  // every action regardless of what buttons are shown here.
  const canAct =
    !!user &&
    !!detail &&
    ((detail.status === "PENDING_MANAGER_APPROVAL" && user.role === "MANAGER") ||
      (detail.status === "PENDING_FINANCE_APPROVAL" && user.role === "FINANCE") ||
      user.role === "ADMIN");

  async function handleApprove() {
    if (!id) return;
    setActionError(null);
    setIsActing(true);
    try {
      setDetail(await approveQuoteApproval(id));
    } catch (err) {
      setActionError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to approve this quote."
      );
    } finally {
      setIsActing(false);
    }
  }

  async function handleConfirmNoteAction() {
    if (!id || !pendingAction) return;
    setActionError(null);
    setIsActing(true);
    try {
      const updated =
        pendingAction === "return"
          ? await returnQuoteForRevision(id, note)
          : await rejectQuoteApproval(id, note);
      setDetail(updated);
      setPendingAction(null);
      setNote("");
    } catch (err) {
      setActionError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to submit this decision."
      );
    } finally {
      setIsActing(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/sales/approvals">
          ← Back to Approvals
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="sales-page">
        <p className="sales-empty">Loading...</p>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>
            Approval Detail: {detail.quoteNumber} ({detail.customer.name})
          </h1>
          <p className="page-subtitle">Total: {formatCurrency(detail.totalAmount)}</p>
        </div>
        <Link className="sales-back-link" to="/sales/approvals">
          ← Back to Approvals
        </Link>
      </div>

      <div className="approval-badges">
        {detail.riskLevel && (
          <span className={`risk-badge risk-${detail.riskLevel}`}>Blended Risk: {detail.riskLevel}</span>
        )}
        <span className="tier-badge">Customer Tier: {detail.customerTier}</span>
      </div>

      {actionError && <div className="banner-error">{actionError}</div>}

      <div className="sales-card">
        <h2>Why This Quote Was Flagged</h2>
        <table className="sales-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Discount Given</th>
              <th>Limit Allowed</th>
              <th>Over By</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((line) => (
              <tr key={line.productId}>
                <td>
                  {line.productName} ({line.category})
                </td>
                <td>{line.discountGivenPercentage}%</td>
                <td>{line.limitAllowedPercentage}%</td>
                <td className={line.overByPoints > 0 ? "over-limit" : "within-limit"}>
                  {line.overByPoints > 0 ? `${line.overByPoints} pt OVER` : "0 pt — OK"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="explainer-text">
          Worst single line plus overall pattern across the order sets the blended score. One bad line
          is enough to require approval.
        </p>
      </div>

      <div className="sales-card">
        <h2>Approval Progress</h2>
        <div className="workflow-stepper">
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
        {detail.workflow.outcome === "REJECTED" && (
          <div className="banner-error" style={{ marginTop: "1rem" }}>
            This quotation was rejected.
          </div>
        )}
        {detail.workflow.outcome === "RETURNED" && (
          <div className="banner-error" style={{ marginTop: "1rem" }}>
            This quotation was returned to the Sales Rep for revision.
          </div>
        )}
      </div>

      <div className="sales-card">
        <h2>Audit Trail</h2>
        {detail.auditTrail.length === 0 ? (
          <p className="sales-empty">No activity yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Date</th>
                <th>Note</th>
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

      {canAct && (
        <div className="sales-card">
          <h2>Decision</h2>
          {pendingAction && (
            <div className="product-search-row">
              <input
                type="text"
                placeholder={`Reason for ${pendingAction === "return" ? "returning" : "rejecting"}...`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          )}
          <div className="sales-actions">
            {!pendingAction && (
              <>
                <button className="sales-btn sales-btn-primary" onClick={handleApprove} disabled={isActing}>
                  Approve
                </button>
                <button className="sales-btn" onClick={() => setPendingAction("return")} disabled={isActing}>
                  Return for Revision
                </button>
                <button
                  className="sales-btn sales-btn-danger"
                  onClick={() => setPendingAction("reject")}
                  disabled={isActing}
                >
                  Reject
                </button>
              </>
            )}
            {pendingAction && (
              <>
                <button
                  className="sales-btn sales-btn-primary"
                  onClick={handleConfirmNoteAction}
                  disabled={isActing || note.trim().length < 3}
                >
                  {isActing ? "Submitting..." : `Confirm ${pendingAction === "return" ? "Return" : "Reject"}`}
                </button>
                <button
                  className="sales-btn"
                  onClick={() => {
                    setPendingAction(null);
                    setNote("");
                  }}
                  disabled={isActing}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
