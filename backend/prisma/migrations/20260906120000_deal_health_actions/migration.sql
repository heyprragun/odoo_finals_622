-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "QuoteAuditAction" ADD VALUE 'MANAGER_CANCELLED';
ALTER TYPE "QuoteAuditAction" ADD VALUE 'NUDGED';
