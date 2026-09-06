-- CreateEnum
CREATE TYPE "CustomerTierChangeType" AS ENUM ('UPGRADE', 'DOWNGRADE');

-- CreateEnum
CREATE TYPE "CustomerTierChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "subscription_change_requests" DROP CONSTRAINT "subscription_change_requests_decidedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "subscription_change_requests" DROP CONSTRAINT "subscription_change_requests_subscriptionId_fkey";

-- DropTable
DROP TABLE "subscription_change_requests";

-- DropEnum
DROP TYPE "SubscriptionChangeStatus";

-- DropEnum
DROP TYPE "SubscriptionChangeType";

-- CreateTable
CREATE TABLE "customer_tier_change_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "requestedTier" "CustomerTier" NOT NULL,
    "type" "CustomerTierChangeType" NOT NULL,
    "status" "CustomerTierChangeStatus" NOT NULL DEFAULT 'PENDING',
    "customerNote" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,

    CONSTRAINT "customer_tier_change_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer_tier_change_requests" ADD CONSTRAINT "customer_tier_change_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tier_change_requests" ADD CONSTRAINT "customer_tier_change_requests_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

