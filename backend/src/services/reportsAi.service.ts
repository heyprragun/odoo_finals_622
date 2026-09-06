import { ApiError } from "../utils/ApiError";
import { callGroq } from "./groq.service";
import type { ProductPerformanceRow } from "./reports.service";

export interface SalesInsight {
  productName: string;
  suggestion: string;
  suggestedDiscountPercentage: number | null;
}

export interface SalesInsightsResult {
  bestSellerInsights: SalesInsight[];
  worstSellerInsights: SalesInsight[];
}

const SYSTEM_PROMPT = `You are a retail sales strategist advising an Admin on how to improve upcoming sales.

You will be given JSON with:
- "bestSelling": the top-performing products (name, unitsSold, revenue, averageDiscountPercentage already given).
- "leastSelling": the worst-performing products (same fields).

For each product in "bestSelling", suggest how to capitalize further (e.g. bundling, a small additional discount, upsell timing) - these are already selling well, so be conservative with discount changes.
For each product in "leastSelling", suggest a concrete discount percentage (0-100) and/or promotional action to revive sales.

Rules:
- Only reference products actually given to you - never invent a product name.
- Each suggestion is a short, concrete sentence (not generic advice).
- "suggestedDiscountPercentage" is a number for leastSelling items when you recommend a discount change, or null if your suggestion isn't discount-based (e.g. for bestSelling items where you're not suggesting a discount).
- Respond with ONLY valid JSON, no markdown, in exactly this shape:
{"bestSellerInsights":[{"productName":"...","suggestion":"...","suggestedDiscountPercentage":null}],"worstSellerInsights":[{"productName":"...","suggestion":"...","suggestedDiscountPercentage":10}]}`;

function normalizeInsights(value: unknown): SalesInsight[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      productName: typeof item.productName === "string" ? item.productName : "",
      suggestion: typeof item.suggestion === "string" ? item.suggestion : "",
      suggestedDiscountPercentage:
        typeof item.suggestedDiscountPercentage === "number" ? item.suggestedDiscountPercentage : null,
    }))
    .filter((item) => item.productName.trim().length > 0 && item.suggestion.trim().length > 0);
}

export async function generateSalesInsights(
  bestSelling: ProductPerformanceRow[],
  leastSelling: ProductPerformanceRow[]
): Promise<SalesInsightsResult> {
  if (bestSelling.length === 0 && leastSelling.length === 0) {
    throw ApiError.badRequest("No product sales data available yet to generate insights from");
  }

  const userContent = JSON.stringify({
    bestSelling: bestSelling.map((p) => ({
      name: p.name,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
      averageDiscountPercentage: p.averageDiscountPercentage,
    })),
    leastSelling: leastSelling.map((p) => ({
      name: p.name,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
      averageDiscountPercentage: p.averageDiscountPercentage,
    })),
  });

  const rawContent = await callGroq(SYSTEM_PROMPT, userContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new ApiError(502, "AI service returned invalid JSON");
  }

  const obj = parsed as { bestSellerInsights?: unknown; worstSellerInsights?: unknown };
  return {
    bestSellerInsights: normalizeInsights(obj?.bestSellerInsights),
    worstSellerInsights: normalizeInsights(obj?.worstSellerInsights),
  };
}
