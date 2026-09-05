-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'PENDING_ADMIN_APPROVAL';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "description" TEXT;

