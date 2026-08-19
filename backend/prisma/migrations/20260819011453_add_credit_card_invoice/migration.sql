-- CreateEnum
CREATE TYPE "CreditCardInvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "credit_card_invoices" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "CreditCardInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_card_invoices_creditCardId_idx" ON "credit_card_invoices"("creditCardId");

-- CreateIndex
CREATE INDEX "credit_card_invoices_creditCardId_status_idx" ON "credit_card_invoices"("creditCardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_invoices_creditCardId_referenceMonth_referenceY_key" ON "credit_card_invoices"("creditCardId", "referenceMonth", "referenceYear");

-- AddForeignKey
ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
