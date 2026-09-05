-- AlterEnum
ALTER TYPE "CustomerRequestStatus" ADD VALUE 'CONVERTED';

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "discountPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "quotes_customerRequestId_key" ON "quotes"("customerRequestId");

