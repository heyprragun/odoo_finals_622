import { Fragment, useEffect, useState } from "react";
import axios from "axios";
import {
  generateRecommendations,
  listRecommendations,
  sendRecommendationToCustomer,
} from "../../api/recommendations";
import type { Quote, QuoteRecommendation } from "../../types/sales";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
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
  // The quote's own live totals/items - used entirely client-side to
  // compute the "what if this were added" preview below. Never sent
  // anywhere, never persisted - purely a same-page estimate, recomputed
  // fresh on every render from real subtotal/discount/tax/cost data (see
  // computeCurrentMetrics/computeImpact).
  quote: Quote;
}

interface CurrentMetrics {
  revenue: number;
  totalAmount: number;
  cost: number | null;
  marginPercent: number | null;
}

// "Revenue" here means post-discount, pre-tax (quote.service.ts's
// calculateTotals calls this taxableAmount) - discount is money the
// business never collects, so it belongs in a margin calculation; tax is
// collected on the government's behalf, so it doesn't. cost is only ever
// available when every line's product.cost was returned (ADMIN viewer -
// see sanitizeQuote.ts) - anything less and margin is null, never guessed.
function computeCurrentMetrics(quote: Quote): CurrentMetrics {
  const revenue = quote.subtotal - quote.discountAmount;
  const costs = quote.items.map((item) =>
    item.product.cost !== undefined ? item.product.cost * item.quantity : null
  );
  const cost = costs.every((c) => c !== null) ? (costs as number[]).reduce((sum, c) => sum + c, 0) : null;
  const marginPercent = cost !== null && revenue > 0 ? ((revenue - cost) / revenue) * 100 : null;
  return { revenue, totalAmount: quote.totalAmount, cost, marginPercent };
}

interface ImpactMetrics {
  addedRevenue: number;
  newTotalAmount: number;
  totalDelta: number;
  newMarginPercent: number | null;
  marginDelta: number | null;
  productMarginPercent: number | null;
}

// Mirrors quote.service.ts's calculateTotals formula (subtotal -> discount
// -> taxable -> tax -> total) applied to "current items + this one
// recommendation at qty 1" - the same blanket discount/tax percentages
// already on the quote apply to the new line too, exactly as they would if
// the Rep actually added it. This is why "added revenue" isn't just the
// product's raw price: a quote already discounted 10% nets 10% less from
// the new line too, and that's the real number worth showing.
function computeImpact(quote: Quote, current: CurrentMetrics, rec: QuoteRecommendation): ImpactMetrics {
  const price = rec.product.unitPrice;
  const newSubtotal = quote.subtotal + price;
  const newDiscountAmount = (newSubtotal * quote.discountPercentage) / 100;
  const newRevenue = newSubtotal - newDiscountAmount;
  const newTaxAmount = (newRevenue * quote.taxPercentage) / 100;
  const newTotalAmount = newRevenue + newTaxAmount;
  const addedRevenue = newRevenue - current.revenue;
  const totalDelta = newTotalAmount - current.totalAmount;

  const recCost = rec.product.cost;
  const hasCost = current.cost !== null && recCost !== undefined;
  const newCost = hasCost ? (current.cost as number) + (recCost as number) : null;
  const newMarginPercent = hasCost && newRevenue > 0 ? ((newRevenue - (newCost as number)) / newRevenue) * 100 : null;
  const marginDelta =
    newMarginPercent !== null && current.marginPercent !== null ? newMarginPercent - current.marginPercent : null;
  const productMarginPercent = recCost !== undefined && price > 0 ? ((price - recCost) / price) * 100 : null;

  return { addedRevenue, newTotalAmount, totalDelta, newMarginPercent, marginDelta, productMarginPercent };
}

function RecommendationRow({
  rec,
  quote,
  current,
  showMargin,
  isPreviewing,
  onTogglePreview,
  onSend,
  isSending,
}: {
  rec: QuoteRecommendation;
  quote: Quote;
  current: CurrentMetrics;
  showMargin: boolean;
  isPreviewing: boolean;
  onTogglePreview: (id: string) => void;
  onSend: (id: string) => void;
  isSending: boolean;
}) {
  const impact = computeImpact(quote, current, rec);

  return (
    <Fragment>
      <tr>
        <td>
          {rec.product.name} <span className="tier-badge">{rec.product.category}</span>
        </td>
        <td>{formatCurrency(rec.product.unitPrice)}</td>
        <td>+{formatCurrency(impact.addedRevenue)}</td>
        {showMargin && (
          <td>{impact.productMarginPercent !== null ? formatPercent(impact.productMarginPercent) : "—"}</td>
        )}
        <td>{rec.reason ?? "—"}</td>
        <td>
          <div className="sales-actions">
            <button className="sales-btn" onClick={() => onTogglePreview(rec.id)}>
              {isPreviewing ? "Hide Impact" : "Preview Impact"}
            </button>
            {rec.status === "SUGGESTED" ? (
              <button className="sales-btn sales-btn-primary" onClick={() => onSend(rec.id)} disabled={isSending}>
                Send to Customer
              </button>
            ) : (
              <span className={`status-badge status-${rec.status}`}>
                {rec.status === "SENT_TO_CUSTOMER" ? "Sent to Customer" : rec.status}
              </span>
            )}
          </div>
        </td>
      </tr>
      {isPreviewing && (
        <tr>
          <td colSpan={showMargin ? 6 : 5}>
            <div className="impact-panel">
              <div className="impact-metric">
                <span className="impact-label">Added Revenue</span>
                <span className="impact-value positive">+{formatCurrency(impact.addedRevenue)}</span>
              </div>
              <div className="impact-metric">
                <span className="impact-label">Quote Total</span>
                <span className="impact-value">
                  {formatCurrency(quote.totalAmount)} → {formatCurrency(impact.newTotalAmount)} (+
                  {formatCurrency(impact.totalDelta)})
                </span>
              </div>
              {showMargin && current.marginPercent !== null && impact.newMarginPercent !== null && (
                <div className="impact-metric">
                  <span className="impact-label">Margin</span>
                  <span className={`impact-value ${(impact.marginDelta ?? 0) >= 0 ? "positive" : "negative"}`}>
                    {formatPercent(current.marginPercent)} → {formatPercent(impact.newMarginPercent)} (
                    {formatSignedPercent(impact.marginDelta ?? 0)})
                  </span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// AI-generated (Groq) upsell/cross-sell suggestions, grounded in the real
// product catalog - only the owning Sales Rep (or Admin) can generate/send
// these, matching the backend's own authorization. The commercial-impact
// preview (added revenue, margin before/after) is purely a client-side
// estimate on top of that - it never changes what "Send to Customer" or the
// customer's own Accept/Decline actually do.
export function RecommendationsPanel({ quoteId, hasItems, onBeforeGenerate, quote }: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<QuoteRecommendation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

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

  function togglePreview(id: string) {
    setPreviewId((current) => (current === id ? null : id));
  }

  const upsell = recommendations?.filter((r) => r.type === "UPSELL") ?? [];
  const crossSell = recommendations?.filter((r) => r.type === "CROSS_SELL") ?? [];
  // Margin needs Product.cost, which the backend only ever includes for an
  // ADMIN viewer (see sanitizeQuote.ts/recommendation.service.ts) - a Sales
  // Rep viewing their own quote still sees price/added revenue, just never
  // a cost-derived number, matching sanitizeProduct.ts's existing rule.
  const showMargin = recommendations?.some((r) => r.product.cost !== undefined) ?? false;
  const current = computeCurrentMetrics(quote);

  function renderTable(list: QuoteRecommendation[]) {
    return (
      <table className="sales-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Added Revenue</th>
            {showMargin && <th>Est. Margin</th>}
            <th>Why</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((rec) => (
            <RecommendationRow
              key={rec.id}
              rec={rec}
              quote={quote}
              current={current}
              showMargin={showMargin}
              isPreviewing={previewId === rec.id}
              onTogglePreview={togglePreview}
              onSend={handleSend}
              isSending={sendingId === rec.id}
            />
          ))}
        </tbody>
      </table>
    );
  }

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
          {renderTable(upsell)}
        </>
      )}

      {crossSell.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.9rem", margin: "0.75rem 0 0.5rem" }}>Cross-Sell</h3>
          {renderTable(crossSell)}
        </>
      )}
    </div>
  );
}
