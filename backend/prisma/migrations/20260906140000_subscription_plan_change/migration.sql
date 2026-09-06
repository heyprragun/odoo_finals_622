-- AlterTable
ALTER TABLE "customer_requests" ADD COLUMN     "modifiesSubscriptionId" TEXT;

-- AddForeignKey
ALTER TABLE "customer_requests" ADD CONSTRAINT "customer_requests_modifiesSubscriptionId_fkey" FOREIGN KEY ("modifiesSubscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
