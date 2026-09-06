import { callGroq } from "./groq.service";

export interface WarehouseLocationInfo {
  warehouseId: string;
  warehouseName: string;
  location: string;
}

const SYSTEM_PROMPT = `You are a logistics cost-estimation assistant for a B2B distributor in India.

You will be given JSON with:
- "destination": the city/region the order ships to.
- "warehouses": candidate warehouses, each with "warehouseId" and "location" (its city/region).

For each warehouse, estimate a realistic PER-UNIT shipping cost in INR to ship one unit of a typical
mid-size product from that warehouse's location to the destination, based on real-world geographic
distance between the two places (same city is cheapest, same state is more, a distant state further
still). These are relative estimates for comparing warehouses against each other, not exact quotes.

Rules:
- You MUST return exactly one entry per warehouseId given, using the exact ids provided - never invent
  or omit one.
- Vary the numbers to reflect actual relative distance - do not return the same value for every
  warehouse unless their locations are genuinely equidistant from the destination.
- Respond with ONLY valid JSON, no markdown, in exactly this shape:
{"estimates":[{"warehouseId":"...","estimatedCostPerUnit":<number>}]}`;

function normalizeEstimates(value: unknown, warehouseIds: string[]): Map<string, number> {
  const result = new Map<string, number>();
  if (!Array.isArray(value)) return result;
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const warehouseId = typeof record.warehouseId === "string" ? record.warehouseId : null;
    const cost = typeof record.estimatedCostPerUnit === "number" ? record.estimatedCostPerUnit : null;
    if (warehouseId && warehouseIds.includes(warehouseId) && cost !== null && Number.isFinite(cost) && cost >= 0) {
      result.set(warehouseId, cost);
    }
  }
  return result;
}

/**
 * Asks Groq to estimate a relative per-unit shipping cost from each
 * candidate warehouse to a destination location, so inventory.service.ts's
 * suggestStockAllocation can fill the cheapest warehouse(s) first instead
 * of just the best-stocked one. Callers must treat failures as "no
 * estimate available" and fall back to the existing stock-based
 * suggestion - this is an optimization on top of a working default, never
 * a hard dependency for building a quote.
 *
 * Returns null (not a partial/empty Map) on any failure or if Groq didn't
 * return an estimate for every warehouse asked about, so callers don't
 * silently optimize with incomplete data.
 */
export async function estimateShippingCostsPerWarehouse(
  destination: string,
  warehouses: WarehouseLocationInfo[]
): Promise<Map<string, number> | null> {
  if (warehouses.length === 0) return null;

  const userContent = JSON.stringify({
    destination,
    warehouses: warehouses.map((w) => ({ warehouseId: w.warehouseId, location: w.location })),
  });

  let raw: string;
  try {
    raw = await callGroq(SYSTEM_PROMPT, userContent);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const warehouseIds = warehouses.map((w) => w.warehouseId);
  const estimates = normalizeEstimates((parsed as { estimates?: unknown })?.estimates, warehouseIds);
  if (estimates.size !== warehouseIds.length) return null;

  return estimates;
}
