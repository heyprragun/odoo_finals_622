-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "QuoteAuditAction" AS ENUM ('SUBMITTED', 'AUTO_APPROVED', 'APPROVED', 'RETURNED', 'REJECTED', 'RESUBMITTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuoteStatus" ADD VALUE 'PENDING_MANAGER_APPROVAL';
ALTER TYPE "QuoteStatus" ADD VALUE 'PENDING_FINANCE_APPROVAL';
ALTER TYPE "QuoteStatus" ADD VALUE 'APPROVED';
ALTER TYPE "QuoteStatus" ADD VALUE 'REJECTED';
ALTER TYPE "QuoteStatus" ADD VALUE 'REVISION_REQUIRED';

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "riskLevel" "RiskLevel";

-- CreateTable
CREATE TABLE "category_discount_limits" (
    "id" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "maxDiscountPercentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_discount_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_audit_entries" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "QuoteAuditAction" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_discount_limits_category_key" ON "category_discount_limits"("category");

-- AddForeignKey
ALTER TABLE "quote_audit_entries" ADD CONSTRAINT "quote_audit_entries_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_audit_entries" ADD CONSTRAINT "quote_audit_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

