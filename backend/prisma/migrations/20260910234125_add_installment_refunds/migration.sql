/*
  Warnings:

  - A unique constraint covering the columns `[refundForInstallmentPurchaseId]` on the table `financial_transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "InstallmentPurchaseStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "refundForInstallmentPurchaseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_refundForInstallmentPurchaseId_key" ON "financial_transactions"("refundForInstallmentPurchaseId");

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_refundForInstallmentPurchaseId_fkey" FOREIGN KEY ("refundForInstallmentPurchaseId") REFERENCES "credit_card_installment_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
