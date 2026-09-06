import { useState } from "react";
import axios from "axios";
import { getSalesInsights } from "../../../api/reports";
import type { SalesInsight, SalesInsightsResult } from "../../../types/sales";
import "../sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function InsightList({ insights }: { insights: SalesInsight[] }) {
  if (insights.length === 0) {
    return <p className="sales-empty">No suggestions.</p>;
  }
  return (
    <table className="sales-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Suggestion</th>
          <th>Suggested Discount</th>
        </tr>
      </thead>
      <tbody>
        {insights.map((insight, index) => (
          <tr key={index}>
            <td>{insight.productName}</td>
            <td>{insight.suggestion}</td>
            <td>{insight.suggestedDiscountPercentage !== null ? `${insight.suggestedDiscountPercentage}%` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// AI-generated (Groq), grounded in this admin's own real best/worst-selling
// product data - never invents products, just suggests discount/promotion
// ideas for the ones actually in the report.
export function AiInsightsTab() {
  const [result, setResult] = useState<SalesInsightsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);
    try {
      setResult(await getSalesInsights());
    } catch (err) {
      setError(errorMessage(err, "Failed to generate insights."));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="sales-card">
      <div className="sales-header" style={{ marginBottom: "0.75rem" }}>
        <div>
          <h2 style={{ margin: 0 }}>AI Sales Insights</h2>
          <p className="page-subtitle">
            AI-suggested discounts and promotions for your best- and worst-selling products.
          </p>
        </div>
        <button className="sales-btn sales-btn-primary" onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating..." : result ? "Regenerate" : "Generate Insights"}
        </button>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {result && (
        <>
          <h3 style={{ fontSize: "0.95rem" }}>Best Sellers - How to Capitalize</h3>
          <InsightList insights={result.bestSellerInsights} />
          <h3 style={{ fontSize: "0.95rem", marginTop: "1.25rem" }}>Worst Sellers - How to Revive</h3>
          <InsightList insights={result.worstSellerInsights} />
        </>
      )}

      {!result && !error && <p className="sales-empty">Click Generate Insights to get AI-powered suggestions.</p>}
    </div>
  );
}
