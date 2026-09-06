-- CreateEnum
CREATE TYPE "DiscountReviewStatus" AS ENUM ('NONE', 'PENDING');

-- AlterTable
ALTER TABLE "customer_requests" ADD COLUMN     "discountReviewStatus" "DiscountReviewStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "proposedDiscountPercentage" DECIMAL(5,2);

