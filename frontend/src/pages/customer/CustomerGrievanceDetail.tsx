import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import axios from "axios";
import {
  addMyGrievanceMessage,
  createGrievance,
  getMyGrievanceByOrder,
  resolveMyGrievance,
} from "../../api/customerPortal";
import type { GrievanceDetail } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

interface OrderHint {
  quoteNumber?: string;
  totalAmount?: number;
  items?: { productName: string; quantity: number }[];
}

export function CustomerGrievanceDetail() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const location = useLocation();
  const orderHint = (location.state as OrderHint | null) ?? {};

  const [grievance, setGrievance] = useState<GrievanceDetail | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!quoteId) return;
    getMyGrievanceByOrder(quoteId)
      .then((g) => {
        setGrievance(g);
        setHasLoaded(true);
      })
      .catch((err) => {
        setLoadError(errorMessage(err, "Failed to load this grievance."));
        setHasLoaded(true);
      });
  }, [quoteId]);

  async function handleRaise() {
    if (!quoteId || !description.trim()) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      setGrievance(await createGrievance(quoteId, description.trim()));
      setDescription("");
    } catch (err) {
      setSubmitError(errorMessage(err, "Failed to raise this grievance."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendMessage() {
    if (!grievance || !message.trim()) return;
    setSendError(null);
    setIsSending(true);
    try {
      setGrievance(await addMyGrievanceMessage(grievance.id, message.trim()));
      setMessage("");
    } catch (err) {
      setSendError(errorMessage(err, "Failed to send this message."));
    } finally {
      setIsSending(false);
    }
  }

  async function handleResolve() {
    if (!grievance) return;
    if (!window.confirm("Mark this grievance as resolved? You won't be able to send further messages once resolved.")) {
      return;
    }
    setSendError(null);
    setIsResolving(true);
    try {
      setGrievance(await resolveMyGrievance(grievance.id));
    } catch (err) {
      setSendError(errorMessage(err, "Failed to mark this resolved."));
    } finally {
      setIsResolving(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/portal/grievances">
          ← Back to Grievances
        </Link>
      </div>
    );
  }

  if (!hasLoaded) {
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
          <h1>Order {orderHint.quoteNumber ?? quoteId}</h1>
          {grievance && (
            <p className="page-subtitle">
              <span className={`status-badge status-${grievance.status}`}>{grievance.status}</span>
            </p>
          )}
        </div>
        <Link className="sales-back-link" to="/portal/grievances">
          ← Back to Grievances
        </Link>
      </div>

      {orderHint.items && orderHint.items.length > 0 && (
        <div className="sales-card">
          <h2>Order Details</h2>
          <p>{orderHint.items.map((i) => `${i.productName} x${i.quantity}`).join(", ")}</p>
          {orderHint.totalAmount !== undefined && (
            <p className="explainer-text">Total: {formatCurrency(orderHint.totalAmount)}</p>
          )}
        </div>
      )}

      {!grievance ? (
        <div className="sales-card">
          <h2>Raise a Grievance</h2>
          <p className="explainer-text" style={{ margin: "0 0 1rem" }}>
            Describe the issue you faced with the delivery of this order.
          </p>
          {submitError && <div className="banner-error">{submitError}</div>}
          <textarea
            rows={4}
            placeholder="e.g. Item arrived damaged, wrong quantity delivered, delivery was significantly delayed..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem 0.7rem",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.9rem",
              fontFamily: "inherit",
            }}
          />
          <div className="sales-actions" style={{ marginTop: "1rem" }}>
            <button
              className="sales-btn sales-btn-primary"
              onClick={handleRaise}
              disabled={isSubmitting || !description.trim()}
            >
              {isSubmitting ? "Submitting..." : "Raise Grievance"}
            </button>
          </div>
        </div>
      ) : (
        <div className="sales-card">
          <h2>Grievance Discussion</h2>
          {sendError && <div className="banner-error">{sendError}</div>}
          <div className="discussion-thread">
            <div className="discussion-message own">
              <div className="discussion-message-meta">
                <strong>You</strong>{" "}
                <span className="discussion-message-time">{new Date(grievance.createdAt).toLocaleString()}</span>
              </div>
              <div className="discussion-message-text">{grievance.description}</div>
            </div>
            {grievance.messages.map((m) => (
              <div key={m.id} className={`discussion-message${m.user.role === "CUSTOMER" ? " own" : ""}`}>
                <div className="discussion-message-meta">
                  <strong>{m.user.role === "CUSTOMER" ? "You" : m.user.name}</strong>{" "}
                  {m.user.role !== "CUSTOMER" && (
                    <span className="tier-badge">{m.user.role === "ADMIN" ? "Admin" : "Manager"}</span>
                  )}{" "}
                  <span className="discussion-message-time">{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <div className="discussion-message-text">{m.message}</div>
              </div>
            ))}
          </div>

          {grievance.status === "OPEN" ? (
            <>
              <div className="product-search-row" style={{ marginTop: "1rem", marginBottom: 0 }}>
                <input
                  type="text"
                  placeholder="Reply..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  className="sales-btn sales-btn-primary"
                  onClick={handleSendMessage}
                  disabled={isSending || !message.trim()}
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
              <div className="sales-actions" style={{ marginTop: "1rem" }}>
                <button className="sales-btn" onClick={handleResolve} disabled={isResolving}>
                  {isResolving ? "Updating..." : "Mark Resolved"}
                </button>
              </div>
            </>
          ) : (
            <p className="sales-empty" style={{ marginTop: "1rem" }}>
              This grievance has been resolved.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
