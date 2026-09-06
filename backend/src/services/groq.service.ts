import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface CatalogEntry {
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
}

export interface QuoteItemEntry {
  sku: string;
  name: string;
  category: string;
  quantity: number;
}

export interface RecommendationSuggestion {
  sku: string;
  reason: string;
}

export interface RecommendationResult {
  upsell: RecommendationSuggestion[];
  crossSell: RecommendationSuggestion[];
}

const SYSTEM_PROMPT = `You are a B2B sales assistant helping a sales rep find upsell and cross-sell opportunities for a quote in progress.

You will be given JSON with:
- "catalog": the full list of products actually available to sell (sku, name, category, unitPrice).
- "quoteItems": the products already on this quote.

Suggest:
- "upsell": 2-3 products from the catalog that are a premium/higher-value alternative or natural add-on to something already in the quote.
- "crossSell": 2-3 products from the catalog, ideally from a different category than what's already in the quote, that commonly get bought alongside it.

Rules:
- You MUST only use "sku" values that appear in "catalog". Never invent a sku.
- Never suggest a sku that is already in "quoteItems".
- Each suggestion needs a short one-sentence "reason".
- Respond with ONLY valid JSON, no markdown, in exactly this shape:
{"upsell":[{"sku":"...","reason":"..."}],"crossSell":[{"sku":"...","reason":"..."}]}`;

// Low-level Groq chat-completion call, shared by every AI feature in this
// app (upsell/cross-sell recommendations, sales report insights, and
// whatever comes next) - each caller supplies its own system prompt and
// parses the returned JSON string for its own shape.
export async function callGroq(systemPrompt: string, userContent: string): Promise<string> {
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch {
    throw new ApiError(502, "Could not reach the AI service");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(502, `AI service returned an error (${response.status}): ${body.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ApiError(502, "AI service returned an unexpected response");
  }
  return content;
}

function normalizeSuggestions(value: unknown): RecommendationSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      sku: typeof item.sku === "string" ? item.sku : "",
      reason: typeof item.reason === "string" ? item.reason : "",
    }))
    .filter((item) => item.sku.trim().length > 0);
}

export async function generateRecommendations(
  catalog: CatalogEntry[],
  quoteItems: QuoteItemEntry[]
): Promise<RecommendationResult> {
  const userContent = JSON.stringify({ catalog, quoteItems });
  const rawContent = await callGroq(SYSTEM_PROMPT, userContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new ApiError(502, "AI recommendation service returned invalid JSON");
  }

  const obj = parsed as { upsell?: unknown; crossSell?: unknown };
  return {
    upsell: normalizeSuggestions(obj?.upsell),
    crossSell: normalizeSuggestions(obj?.crossSell),
  };
}
