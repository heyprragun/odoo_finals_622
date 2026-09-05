-- CreateTable
CREATE TABLE "customer_tier_discount_limits" (
    "id" TEXT NOT NULL,
    "tier" "CustomerTier" NOT NULL,
    "maxDiscountPercentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_tier_discount_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_engine_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "highRiskOverByThreshold" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "highRiskBreachCountMin" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_engine_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_tier_discount_limits_tier_key" ON "customer_tier_discount_limits"("tier");

