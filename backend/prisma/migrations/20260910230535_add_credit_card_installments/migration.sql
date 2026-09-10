/*
  Warnings:

  - A unique constraint covering the columns `[installmentPurchaseId,installmentNumber]` on the table `financial_transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InstallmentPurchaseStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "installmentPurchaseId" TEXT;

-- CreateTable
CREATE TABLE "credit_card_installment_purchases" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT NOT NULL,
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "status" "InstallmentPurchaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_installment_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_card_installment_purchases_workspaceId_idx" ON "credit_card_installment_purchases"("workspaceId");

-- CreateIndex
CREATE INDEX "credit_card_installment_purchases_workspaceId_status_idx" ON "credit_card_installment_purchases"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "credit_card_installment_purchases_creditCardId_idx" ON "credit_card_installment_purchases"("creditCardId");

-- CreateIndex
CREATE INDEX "credit_card_installment_purchases_categoryId_idx" ON "credit_card_installment_purchases"("categoryId");

-- CreateIndex
CREATE INDEX "financial_transactions_installmentPurchaseId_idx" ON "financial_transactions"("installmentPurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_installmentPurchaseId_installmentNum_key" ON "financial_transactions"("installmentPurchaseId", "installmentNumber");

-- AddForeignKey
ALTER TABLE "credit_card_installment_purchases" ADD CONSTRAINT "credit_card_installment_purchases_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_installment_purchases" ADD CONSTRAINT "credit_card_installment_purchases_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_installment_purchases" ADD CONSTRAINT "credit_card_installment_purchases_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_installmentPurchaseId_fkey" FOREIGN KEY ("installmentPurchaseId") REFERENCES "credit_card_installment_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
