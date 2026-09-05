-- AlterEnum
ALTER TYPE "QuoteAuditAction" ADD VALUE 'CUSTOMER_NEGOTIATION';

-- AlterTable
ALTER TABLE "customer_requests" ADD COLUMN     "expectedDiscountPercentage" DECIMAL(5,2);

