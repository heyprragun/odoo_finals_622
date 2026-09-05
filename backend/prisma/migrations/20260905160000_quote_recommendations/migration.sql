-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('UPSELL', 'CROSS_SELL');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('SUGGESTED', 'SENT_TO_CUSTOMER', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "quote_recommendations" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "reason" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_recommendations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quote_recommendations" ADD CONSTRAINT "quote_recommendations_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_recommendations" ADD CONSTRAINT "quote_recommendations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

