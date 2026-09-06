import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { addOrderComment, listOrderComments } from "../../api/orderComments";
import type { OrderComment } from "../../types/sales";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function roleLabel(role: string) {
  switch (role) {
    case "SALES_REP":
      return "Sales Rep";
    case "MANAGER":
      return "Manager";
    case "FINANCE":
      return "Finance";
    case "ADMIN":
      return "Admin";
    default:
      return role;
  }
}

const POLL_INTERVAL_MS = 8000;

/**
 * Shared discussion thread for one order (Quote) - every internal role that
 * can see this quote sees the exact same thread, embedded wherever a quote's
 * detail already shows (Quote Builder, Approval Detail, Deal Health Detail)
 * so it's genuinely "common" no matter which page someone reached it from.
 * Polls rather than pushing (no websocket infra in this app) - simple and
 * good enough for an internal discussion thread, not a consumer chat app.
 */
export function TeamDiscussion({ quoteId }: { quoteId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<OrderComment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      listOrderComments(quoteId)
        .then((data) => {
          if (!cancelled) setComments(data);
        })
        .catch((err) => {
          if (!cancelled) setLoadError(errorMessage(err, "Failed to load the discussion."));
        });
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [quoteId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [comments?.length]);

  async function handleSend() {
    if (!message.trim() || isSending) return;
    setSendError(null);
    setIsSending(true);
    try {
      setComments(await addOrderComment(quoteId, message.trim()));
      setMessage("");
    } catch (err) {
      setSendError(errorMessage(err, "Failed to send this message."));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="sales-card">
      <h2>Team Discussion</h2>
      <p className="explainer-text" style={{ margin: "0 0 1rem" }}>
        Shared with every internal team on this order - Sales, Manager, Finance, and Admin all see the same thread.
      </p>
      {loadError && <div className="banner-error">{loadError}</div>}
      {sendError && <div className="banner-error">{sendError}</div>}

      <div className="discussion-thread">
        {comments === null && !loadError && <p className="sales-empty">Loading...</p>}
        {comments !== null && comments.length === 0 && (
          <p className="sales-empty">No messages yet - start the discussion below.</p>
        )}
        {comments?.map((c) => (
          <div key={c.id} className={`discussion-message${c.user.id === user?.id ? " own" : ""}`}>
            <div className="discussion-message-meta">
              <strong>{c.user.name}</strong> <span className="tier-badge">{roleLabel(c.user.role)}</span>{" "}
              <span className="discussion-message-time">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <div className="discussion-message-text">{c.message}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="product-search-row" style={{ marginTop: "1rem", marginBottom: 0 }}>
        <input
          type="text"
          placeholder="Write a message to the team..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          style={{ flex: 1 }}
        />
        <button
          className="sales-btn sales-btn-primary"
          onClick={handleSend}
          disabled={isSending || !message.trim()}
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
