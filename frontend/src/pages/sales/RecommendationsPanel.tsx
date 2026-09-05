import { useEffect, useState } from "react";
import axios from "axios";
import {
  generateRecommendations,
  listRecommendations,
  sendRecommendationToCustomer,
} from "../../api/recommendations";
import type { QuoteRecommendation } from "../../types/sales";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

interface RecommendationsPanelProps {
  quoteId: string;
  hasItems: boolean;
  // Generation reads the quote's SAVED items from the database, not
  // whatever's currently in the on-screen cart - if the Rep just added
  // products but hasn't clicked Save Draft yet, the backend would otherwise
  // see zero items and reject the request. Passing the Builder's own save
  // function here lets Generate save first automatically, so it works
  // regardless of whether the Rep remembered to save. Omit when the quote
  // isn't editable (nothing unsaved to persist).
  onBeforeGenerate?: () => Promise<unknown>;
}

function RecommendationRow({
  rec,
  onSend,
  isSending,
}: {
  rec: QuoteRecommendation;
  onSend: (id: string) => void;
  isSending: boolean;
}) {
  return (
    <tr>
      <td>
        {rec.product.name} <span className="tier-badge">{rec.product.category}</span>
      </td>
      <td>{formatCurrency(rec.product.unitPrice)}</td>
      <td>{rec.reason ?? "—"}</td>
      <td>
        {rec.status === "SUGGESTED" ? (
          <button className="sales-btn sales-btn-primary" onClick={() => onSend(rec.id)} disabled={isSending}>
            Send to Customer
          </button>
        ) : (
          <span className={`status-badge status-${rec.status}`}>
            {rec.status === "SENT_TO_CUSTOMER" ? "Sent to Customer" : rec.status}
          </span>
        )}
      </td>
    </tr>
  );
}

// AI-generated (Groq) upsell/cross-sell suggestions, grounded in the real
// product catalog - only the owning Sales Rep (or Admin) can generate/send
// these, matching the backend's own authorization.
export function RecommendationsPanel({ quoteId, hasItems, onBeforeGenerate }: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<QuoteRecommendation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    listRecommendations(quoteId)
      .then(setRecommendations)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load recommendations.")));
  }, [quoteId]);

  async function handleGenerate() {
    setActionError(null);
    setIsGenerating(true);
    try {
      if (onBeforeGenerate) {
        await onBeforeGenerate();
      }
      setRecommendations(await generateRecommendations(quoteId));
    } catch (err) {
      setActionError(errorMessage(err, "Failed to generate recommendations."));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSend(recommendationId: string) {
    setActionError(null);
    setSendingId(recommendationId);
    try {
      setRecommendations(await sendRecommendationToCustomer(quoteId, recommendationId));
    } catch (err) {
      setActionError(errorMessage(err, "Failed to send this recommendation."));
    } finally {
      setSendingId(null);
    }
  }

  const upsell = recommendations?.filter((r) => r.type === "UPSELL") ?? [];
  const crossSell = recommendations?.filter((r) => r.type === "CROSS_SELL") ?? [];

  return (
    <div className="sales-card">
      <div className="sales-header" style={{ marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Upsell &amp; Cross-Sell Recommendations</h2>
        <button
          className="sales-btn sales-btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating || !hasItems}
        >
          {isGenerating ? "Generating..." : recommendations && recommendations.length > 0 ? "Regenerate" : "Generate"}
        </button>
      </div>

      {!hasItems && <p className="sales-empty">Add products to the quote before generating recommendations.</p>}
      {loadError && <div className="banner-error">{loadError}</div>}
      {actionError && <div className="banner-error">{actionError}</div>}

      {recommendations !== null && recommendations.length === 0 && hasItems && (
        <p className="sales-empty">
          No recommendations yet. Click Generate for AI-powered suggestions based on your catalog.
        </p>
      )}

      {upsell.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.9rem", margin: "0.75rem 0 0.5rem" }}>Upsell</h3>
          <table className="sales-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Why</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {upsell.map((rec) => (
                <RecommendationRow key={rec.id} rec={rec} onSend={handleSend} isSending={sendingId === rec.id} />
              ))}
            </tbody>
          </table>
        </>
      )}

      {crossSell.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.9rem", margin: "0.75rem 0 0.5rem" }}>Cross-Sell</h3>
          <table className="sales-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Why</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {crossSell.map((rec) => (
                <RecommendationRow key={rec.id} rec={rec} onSend={handleSend} isSending={sendingId === rec.id} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
