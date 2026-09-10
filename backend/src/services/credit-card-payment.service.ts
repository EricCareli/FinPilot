import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface PayCreditCardInvoiceInput {
  workspaceId: string;
  invoiceId: string;
  paymentAccountId: string;
  paymentDate: Date;
}

export async function payCreditCardInvoice(
  input: PayCreditCardInvoiceInput,
) {
  return prisma.$transaction(
    async (tx) => {
      const invoice =
        await tx.creditCardInvoice.findFirst({
          where: {
            id: input.invoiceId,
            creditCard: {
              account: {
                workspaceId:
                  input.workspaceId,
                status: 'ACTIVE',
              },
            },
          },
          include: {
            creditCard: {
              include: {
                account: true,
              },
            },
          },
        });

      if (!invoice) {
        throw new AppError(
          'Invoice not found',
          404,
        );
      }

      if (
        invoice.status !== 'OPEN'
      ) {
        throw new AppError(
          'Invoice is not open',
          400,
        );
      }

      if (
        Number.isNaN(
          input.paymentDate.getTime(),
        )
      ) {
        throw new AppError(
          'Invalid payment date',
          400,
        );
      }

      const paymentAccount =
        await tx.account.findFirst({
          where: {
            id:
              input.paymentAccountId,
            workspaceId:
              input.workspaceId,
            status: 'ACTIVE',
          },
        });

      if (!paymentAccount) {
        throw new AppError(
          'Payment account not found',
          404,
        );
      }

      if (
        paymentAccount.type ===
        'CREDIT_CARD'
      ) {
        throw new AppError(
          'Payment account cannot be a credit card',
          400,
        );
      }

      if (
        paymentAccount.currency !==
        invoice.creditCard.account
          .currency
      ) {
        throw new AppError(
          'Payment account currency does not match invoice currency',
          400,
        );
      }

      const paymentAmount =
        new Prisma.Decimal(
          invoice.totalAmount,
        );

      if (
        paymentAmount.lte(0)
      ) {
        throw new AppError(
          'Invoice has no outstanding amount',
          400,
        );
      }

      const entries =
        await tx.ledgerEntry.findMany({
          where: {
            accountId:
              paymentAccount.id,
            transaction: {
              workspaceId:
                input.workspaceId,
              status: 'POSTED',
            },
          },
          select: {
            type: true,
            amount: true,
          },
        });

      /*
       * IMPORTANT:
       * initialBalance is already represented
       * by an ADJUSTMENT ledger entry.
       */
      let balance =
        new Prisma.Decimal(0);

      for (const entry of entries) {
        if (
          entry.type === 'CREDIT'
        ) {
          balance =
            balance.plus(
              entry.amount,
            );
        } else {
          balance =
            balance.minus(
              entry.amount,
            );
        }
      }

      if (
        balance.lt(
          paymentAmount,
        )
      ) {
        throw new AppError(
          'Insufficient funds',
          400,
        );
      }

      const transaction =
        await tx.financialTransaction.create({
          data: {
            workspaceId:
              input.workspaceId,
            categoryId: null,
            type: 'TRANSFER',
            status: 'POSTED',
            description:
              `Pagamento da fatura do cartão ${invoice.creditCard.account.name}`,
            transactionDate:
              input.paymentDate,
          },
        });

      await tx.ledgerEntry.createMany({
        data: [
          {
            transactionId:
              transaction.id,
            accountId:
              paymentAccount.id,
            type: 'DEBIT',
            amount:
              paymentAmount,
          },
          {
            transactionId:
              transaction.id,
            accountId:
              invoice.creditCard
                .accountId,
            type: 'CREDIT',
            amount:
              paymentAmount,
          },
        ],
      });

      const paidInvoice =
        await tx.creditCardInvoice.update({
          where: {
            id: invoice.id,
          },
          data: {
            status: 'PAID',
          },
        });

      return {
        invoice:
          paidInvoice,
        transaction,
        paymentAmount,
      };
    },
  );
}