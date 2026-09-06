-- CreateTable
CREATE TABLE "quote_item_allocations" (
    "id" TEXT NOT NULL,
    "quoteItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "estimatedShippingCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_item_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_item_allocations_quoteItemId_warehouseId_key" ON "quote_item_allocations"("quoteItemId", "warehouseId");

-- AddForeignKey
ALTER TABLE "quote_item_allocations" ADD CONSTRAINT "quote_item_allocations_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item_allocations" ADD CONSTRAINT "quote_item_allocations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

