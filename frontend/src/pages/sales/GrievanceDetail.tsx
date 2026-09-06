import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { addStaffGrievanceMessage, getGrievance } from "../../api/grievances";
import type { GrievanceDetail as GrievanceDetailType } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function GrievanceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isDenied = user?.role !== "MANAGER" && user?.role !== "ADMIN";

  const [grievance, setGrievance] = useState<GrievanceDetailType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || isDenied) return;
    getGrievance(id)
      .then(setGrievance)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load this grievance.")));
  }, [id, isDenied]);

  if (isDenied) {
    return <NoAccessBlock title="Grievances" />;
  }

  async function handleSend() {
    if (!id || !message.trim()) return;
    setSendError(null);
    setIsSending(true);
    try {
      setGrievance(await addStaffGrievanceMessage(id, message.trim()));
      setMessage("");
    } catch (err) {
      setSendError(errorMessage(err, "Failed to send this message."));
    } finally {
      setIsSending(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!grievance) {
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
            Grievance: {grievance.quote.quoteNumber}{" "}
            <span className={`status-badge status-${grievance.status}`}>{grievance.status}</span>
          </h1>
          <p className="page-subtitle">
            {grievance.customer.name} <span className="tier-badge">{grievance.customer.tier}</span> ·{" "}
            {formatCurrency(grievance.quote.totalAmount)}
          </p>
        </div>
        <Link className="sales-back-link" to="/dashboard">
          ← Back to Dashboard
        </Link>
      </div>

      {grievance.status === "OPEN" && (
        <div className="banner-error">
          This grievance is still open - it stays open until the customer marks it resolved themselves.
        </div>
      )}
      {sendError && <div className="banner-error">{sendError}</div>}

      <div className="sales-card">
        <h2>Grievance Discussion</h2>
        <div className="discussion-thread">
          <div className="discussion-message">
            <div className="discussion-message-meta">
              <strong>{grievance.customer.name}</strong> <span className="tier-badge">Customer</span>{" "}
              <span className="discussion-message-time">{new Date(grievance.createdAt).toLocaleString()}</span>
            </div>
            <div className="discussion-message-text">{grievance.description}</div>
          </div>
          {grievance.messages.map((m) => (
            <div key={m.id} className={`discussion-message${m.user.id === user?.id ? " own" : ""}`}>
              <div className="discussion-message-meta">
                <strong>{m.user.name}</strong>{" "}
                <span className="tier-badge">{m.user.role === "CUSTOMER" ? "Customer" : m.user.role}</span>{" "}
                <span className="discussion-message-time">{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <div className="discussion-message-text">{m.message}</div>
            </div>
          ))}
        </div>

        {grievance.status === "OPEN" ? (
          <div className="product-search-row" style={{ marginTop: "1rem", marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Reply to the customer..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              style={{ flex: 1 }}
            />
            <button className="sales-btn sales-btn-primary" onClick={handleSend} disabled={isSending || !message.trim()}>
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        ) : (
          <p className="sales-empty" style={{ marginTop: "1rem" }}>
            This grievance has been resolved by the customer.
          </p>
        )}
      </div>
    </div>
  );
}
