import { CustomerTier, Prisma, ProductCategory, RiskLevel } from "@prisma/client";

export interface DiscountLineBreakdown {
  productId: string;
  productName: string;
  category: ProductCategory;
  discountGivenPercentage: number;
  limitAllowedPercentage: number;
  overByPoints: number;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  lines: DiscountLineBreakdown[];
}

export interface DiscountGovernanceContext {
  categoryLimits: Map<ProductCategory, Prisma.Decimal>;
  tierLimit: Prisma.Decimal;
  highRiskOverByThreshold: number;
  highRiskBreachCountMin: number;
}

const RISK_SETTINGS_ID = "singleton";

export async function getCategoryDiscountLimits(
  client: Prisma.TransactionClient
): Promise<Map<ProductCategory, Prisma.Decimal>> {
  const limits = await client.categoryDiscountLimit.findMany();
  return new Map(limits.map((limit) => [limit.category, limit.maxDiscountPercentage]));
}

export async function getCustomerTierDiscountLimits(
  client: Prisma.TransactionClient
): Promise<Map<CustomerTier, Prisma.Decimal>> {
  const limits = await client.customerTierDiscountLimit.findMany();
  return new Map(limits.map((limit) => [limit.tier, limit.maxDiscountPercentage]));
}

// Lazily creates the singleton row with its schema defaults on first read,
// so a fresh install works without a dedicated seed step for it.
export async function getRiskEngineSettings(client: Prisma.TransactionClient) {
  const existing = await client.riskEngineSettings.findUnique({ where: { id: RISK_SETTINGS_ID } });
  if (existing) return existing;
  return client.riskEngineSettings.create({ data: { id: RISK_SETTINGS_ID } });
}

/**
 * Bundles everything the risk engine needs for ONE quote's customer tier.
 */
export async function getDiscountGovernanceContext(
  client: Prisma.TransactionClient,
  customerTier: CustomerTier
): Promise<DiscountGovernanceContext> {
  const [categoryLimits, tierLimits, riskSettings] = await Promise.all([
    getCategoryDiscountLimits(client),
    getCustomerTierDiscountLimits(client),
    getRiskEngineSettings(client),
  ]);

  return {
    categoryLimits,
    tierLimit: tierLimits.get(customerTier) ?? new Prisma.Decimal(100),
    highRiskOverByThreshold: Number(riskSettings.highRiskOverByThreshold),
    highRiskBreachCountMin: riskSettings.highRiskBreachCountMin,
  };
}

/**
 * Discount-governance risk engine.
 *
 * Each line's effective ceiling is the MORE RESTRICTIVE of its category's
 * ceiling and the customer's tier ceiling (a Gold customer's higher overall
 * allowance still can't exceed a low-margin category's own cap). "Over By"
 * is how many percentage points the quote's discount exceeds that line's
 * effective ceiling.
 *
 * Blended score = worst single line's overage, adjusted for how many
 * distinct lines are over ceiling at all ("the overall pattern"): a quote
 * that breaches several categories at once is riskier than one that only
 * breaches a single line by the same margin. One breached line is already
 * enough to require approval (riskLevel above LOW). The HIGH thresholds
 * (worst-line overage, breach count) are admin-configurable via
 * RiskEngineSettings - see governance.service.ts.
 */
export function assessDiscountRisk(
  items: { productId: string; product: { name: string; category: ProductCategory } }[],
  discountPercentage: Prisma.Decimal,
  context: DiscountGovernanceContext
): RiskAssessment {
  const discountGiven = Number(discountPercentage);
  const tierLimit = Number(context.tierLimit);

  const lines: DiscountLineBreakdown[] = items.map((item) => {
    const categoryLimit = context.categoryLimits.get(item.product.category);
    const effectiveLimit = Math.min(categoryLimit ? Number(categoryLimit) : 100, tierLimit);
    const overBy = Math.max(0, discountGiven - effectiveLimit);
    return {
      productId: item.productId,
      productName: item.product.name,
      category: item.product.category,
      discountGivenPercentage: discountGiven,
      limitAllowedPercentage: effectiveLimit,
      overByPoints: Math.round(overBy * 100) / 100,
    };
  });

  const worstOverBy = lines.reduce((max, line) => Math.max(max, line.overByPoints), 0);
  const breachCount = lines.filter((line) => line.overByPoints > 0).length;

  let riskLevel: RiskLevel;
  if (worstOverBy <= 0) {
    riskLevel = RiskLevel.LOW;
  } else if (worstOverBy > context.highRiskOverByThreshold || breachCount >= context.highRiskBreachCountMin) {
    riskLevel = RiskLevel.HIGH;
  } else {
    riskLevel = RiskLevel.MEDIUM;
  }

  return { riskLevel, lines };
}
