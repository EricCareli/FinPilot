-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "financial_transactions_invoiceId_idx" ON "financial_transactions"("invoiceId");

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "credit_card_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
