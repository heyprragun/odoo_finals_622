import { prisma } from "../config/prisma";
import { getRiskEngineSettings } from "./discountGovernance.service";
import type { UpdateGovernanceSettingsInput } from "../validation/governance.validation";

const RISK_SETTINGS_ID = "singleton";

/**
 * Admin-facing read/write for the same three tables the risk engine
 * (discountGovernance.service.ts) consults at quote-submission time:
 * category ceilings, customer-tier ceilings, and the HIGH-risk thresholds.
 * Bundled into one GET/PUT pair to match the single "Save Settings" action
 * on the admin page.
 */
export async function getGovernanceSettings() {
  const [categoryLimits, tierLimits, riskSettings] = await Promise.all([
    prisma.categoryDiscountLimit.findMany({ orderBy: { category: "asc" } }),
    prisma.customerTierDiscountLimit.findMany({ orderBy: { tier: "asc" } }),
    getRiskEngineSettings(prisma),
  ]);

  return {
    categoryLimits: categoryLimits.map((c) => ({
      category: c.category,
      maxDiscountPercentage: Number(c.maxDiscountPercentage),
    })),
    tierLimits: tierLimits.map((t) => ({
      tier: t.tier,
      maxDiscountPercentage: Number(t.maxDiscountPercentage),
    })),
    riskSettings: {
      highRiskOverByThreshold: Number(riskSettings.highRiskOverByThreshold),
      highRiskBreachCountMin: riskSettings.highRiskBreachCountMin,
    },
  };
}

export async function updateGovernanceSettings(input: UpdateGovernanceSettingsInput) {
  await prisma.$transaction(async (tx) => {
    for (const entry of input.categoryLimits) {
      await tx.categoryDiscountLimit.upsert({
        where: { category: entry.category },
        update: { maxDiscountPercentage: entry.maxDiscountPercentage },
        create: { category: entry.category, maxDiscountPercentage: entry.maxDiscountPercentage },
      });
    }

    for (const entry of input.tierLimits) {
      await tx.customerTierDiscountLimit.upsert({
        where: { tier: entry.tier },
        update: { maxDiscountPercentage: entry.maxDiscountPercentage },
        create: { tier: entry.tier, maxDiscountPercentage: entry.maxDiscountPercentage },
      });
    }

    await tx.riskEngineSettings.upsert({
      where: { id: RISK_SETTINGS_ID },
      update: input.riskSettings,
      create: { id: RISK_SETTINGS_ID, ...input.riskSettings },
    });
  });

  return getGovernanceSettings();
}
