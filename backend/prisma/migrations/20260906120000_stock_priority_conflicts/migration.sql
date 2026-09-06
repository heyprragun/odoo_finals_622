-- CreateEnum
CREATE TYPE "StockPriorityConflictStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "stock_priority_conflicts" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantityNeeded" INTEGER NOT NULL,
    "requestingCustomerName" TEXT NOT NULL,
    "requestingTier" "CustomerTier" NOT NULL,
    "requestingMarginPercentage" DECIMAL(5,2),
    "blockingQuoteId" TEXT NOT NULL,
    "blockingQuantity" INTEGER NOT NULL,
    "blockingTier" "CustomerTier" NOT NULL,
    "blockingMarginPercentage" DECIMAL(5,2),
    "status" "StockPriorityConflictStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "stock_priority_conflicts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_priority_conflicts" ADD CONSTRAINT "stock_priority_conflicts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_priority_conflicts" ADD CONSTRAINT "stock_priority_conflicts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_priority_conflicts" ADD CONSTRAINT "stock_priority_conflicts_blockingQuoteId_fkey" FOREIGN KEY ("blockingQuoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_priority_conflicts" ADD CONSTRAINT "stock_priority_conflicts_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
