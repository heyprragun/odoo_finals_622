import { Prisma, ProductCategory, RiskLevel } from "@prisma/client";

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

export async function getCategoryDiscountLimits(
  client: Prisma.TransactionClient
): Promise<Map<ProductCategory, Prisma.Decimal>> {
  const limits = await client.categoryDiscountLimit.findMany();
  return new Map(limits.map((limit) => [limit.category, limit.maxDiscountPercentage]));
}

/**
 * Discount-governance risk engine.
 *
 * Every line is compared against its category's discount ceiling using the
 * quote's overall discount percentage (the only discount input this phase
 * has - there is no per-line discount yet). "Over By" is how many
 * percentage points that line's discount exceeds its category's ceiling.
 *
 * Blended score = worst single line's overage, adjusted for how many
 * distinct lines are over ceiling at all ("the overall pattern"): a quote
 * that breaches several categories at once is riskier than one that only
 * breaches a single line by the same margin. One breached line is already
 * enough to require approval (riskLevel above LOW).
 */
export function assessDiscountRisk(
  items: { productId: string; product: { name: string; category: ProductCategory } }[],
  discountPercentage: Prisma.Decimal,
  limits: Map<ProductCategory, Prisma.Decimal>
): RiskAssessment {
  const discountGiven = Number(discountPercentage);

  const lines: DiscountLineBreakdown[] = items.map((item) => {
    const limit = limits.get(item.product.category);
    const limitAllowed = limit ? Number(limit) : 100;
    const overBy = Math.max(0, discountGiven - limitAllowed);
    return {
      productId: item.productId,
      productName: item.product.name,
      category: item.product.category,
      discountGivenPercentage: discountGiven,
      limitAllowedPercentage: limitAllowed,
      overByPoints: Math.round(overBy * 100) / 100,
    };
  });

  const worstOverBy = lines.reduce((max, line) => Math.max(max, line.overByPoints), 0);
  const breachCount = lines.filter((line) => line.overByPoints > 0).length;

  let riskLevel: RiskLevel;
  if (worstOverBy <= 0) {
    riskLevel = RiskLevel.LOW;
  } else if (worstOverBy > 10 || breachCount >= 2) {
    riskLevel = RiskLevel.HIGH;
  } else {
    riskLevel = RiskLevel.MEDIUM;
  }

  return { riskLevel, lines };
}
