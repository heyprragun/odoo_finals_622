import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listCustomerRequests } from "../../api/customerRequests";
import { listMyQuotes } from "../../api/quotes";
import "./sales.css";

// Quotes resting in any of these states are "awaiting a decision" - covers
// the legacy SUBMITTED value plus both approval stages.
const AWAITING_DECISION_STATUSES = ["SUBMITTED", "PENDING_MANAGER_APPROVAL", "PENDING_FINANCE_APPROVAL"];

export function SalesRepDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSalesRep = user?.role === "SALES_REP";
  const [newRequestCount, setNewRequestCount] = useState<number | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listCustomerRequests(), listMyQuotes()])
      .then(([requests, quotes]) => {
        if (cancelled) return;
        setNewRequestCount(requests.filter((r) => r.status === "NEW").length);
        setDraftCount(quotes.filter((q) => q.status === "DRAFT").length);
        setSubmittedCount(quotes.filter((q) => AWAITING_DECISION_STATUSES.includes(q.status)).length);
      })
      .catch(() => {
        if (!cancelled) {
          setNewRequestCount(0);
          setDraftCount(0);
          setSubmittedCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sales-page">
      <div className="sales-summary-grid">
        <div className="sales-stat">
          <div className="value">{newRequestCount ?? "–"}</div>
          <div className="label">New Customer Requests</div>
        </div>
        <div className="sales-stat">
          <div className="value">{draftCount ?? "–"}</div>
          <div className="label">Draft Quotes</div>
        </div>
        <div className="sales-stat">
          <div className="value">{submittedCount ?? "–"}</div>
          <div className="label">Submitted Quotes</div>
        </div>
      </div>

      {isSalesRep && (
        <div className="sales-actions">
          <button className="sales-btn sales-btn-primary" onClick={() => navigate("/sales/customer-requests")}>
            View Customer Requests
          </button>
          <button className="sales-btn" onClick={() => navigate("/sales/quotes/new")}>
            Create Quote
          </button>
          <button className="sales-btn" onClick={() => navigate("/sales/quotes")}>
            My Quotes
          </button>
        </div>
      )}
    </div>
  );
}
