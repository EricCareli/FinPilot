import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface RefundCreditCardInstallmentPurchaseInput {
  workspaceId: string;
  installmentPurchaseId: string;
  refundDate: Date;
}

export async function refundCreditCardInstallmentPurchase(
  input: RefundCreditCardInstallmentPurchaseInput,
) {
  if (
    Number.isNaN(
      input.refundDate.getTime(),
    )
  ) {
    throw new AppError(
      'Invalid refund date',
      400,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const installmentPurchase =
        await tx.creditCardInstallmentPurchase.findFirst({
          where: {
            id:
              input.installmentPurchaseId,
            workspaceId:
              input.workspaceId,
          },
          include: {
            creditCard: {
              include: {
                account: true,
              },
            },
            transactions: {
              include: {
                invoice: true,
                entries: true,
              },
              orderBy: {
                installmentNumber:
                  'asc',
              },
            },
            refundTransaction: {
              include: {
                entries: true,
              },
            },
          },
        });

      if (!installmentPurchase) {
        throw new AppError(
          'Installment purchase not found',
          404,
        );
      }

      if (
        installmentPurchase.status ===
        'VOIDED'
      ) {
        throw new AppError(
          'Voided installment purchases cannot be refunded',
          400,
        );
      }

      if (
        installmentPurchase.status ===
          'REFUNDED' ||
        installmentPurchase.refundTransaction
      ) {
        throw new AppError(
          'Installment purchase is already refunded',
          400,
        );
      }

      if (
        installmentPurchase.status !==
        'ACTIVE'
      ) {
        throw new AppError(
          'Installment purchase cannot be refunded',
          400,
        );
      }

      if (
        input.refundDate <
        installmentPurchase.purchaseDate
      ) {
        throw new AppError(
          'Refund date cannot be before purchase date',
          400,
        );
      }

      if (
        installmentPurchase.transactions.length !==
        installmentPurchase.installmentCount
      ) {
        throw new AppError(
          'Installment purchase is inconsistent',
          409,
        );
      }

      let originalTotal =
        new Prisma.Decimal(0);

      let historicalAmount =
        new Prisma.Decimal(0);

      const openInstallments: Array<{
        transactionId: string;
        invoiceId: string;
        amount: Prisma.Decimal;
      }> = [];

      for (
        const transaction of
          installmentPurchase.transactions
      ) {
        if (
          transaction.status !==
          'POSTED'
        ) {
          throw new AppError(
            'Installment purchase contains a non-posted installment',
            409,
          );
        }

        if (
          !transaction.invoice
        ) {
          throw new AppError(
            'Installment invoice not found',
            409,
          );
        }

        const debitEntries =
          transaction.entries.filter(
            (entry) =>
              entry.accountId ===
                installmentPurchase
                  .creditCard
                  .accountId &&
              entry.type ===
                'DEBIT',
          );

        if (
          debitEntries.length !== 1
        ) {
          throw new AppError(
            'Installment ledger is inconsistent',
            409,
          );
        }

        const debitEntry =
          debitEntries[0];

        if (!debitEntry) {
          throw new AppError(
            'Installment ledger is inconsistent',
            409,
          );
        }

        originalTotal =
          originalTotal.plus(
            debitEntry.amount,
          );

        if (
          transaction.invoice.status ===
          'OPEN'
        ) {
          if (
            transaction.invoice.totalAmount.lt(
              debitEntry.amount,
            )
          ) {
            throw new AppError(
              'Installment invoice total is inconsistent',
              409,
            );
          }

          openInstallments.push({
            transactionId:
              transaction.id,
            invoiceId:
              transaction.invoice.id,
            amount:
              new Prisma.Decimal(
                debitEntry.amount,
              ),
          });
        } else {
          historicalAmount =
            historicalAmount.plus(
              debitEntry.amount,
            );
        }
      }

      if (
        !originalTotal.eq(
          installmentPurchase.totalAmount,
        )
      ) {
        throw new AppError(
          'Installment purchase total is inconsistent',
          409,
        );
      }

      /*
       * Se todas as faturas ainda estão
       * abertas, o fluxo correto continua
       * sendo VOID, pois ainda não existe
       * histórico financeiro fechado que
       * precise de um REFUND.
       */
      if (
        historicalAmount.lte(0)
      ) {
        throw new AppError(
          'Installment purchase can still be voided because all invoices are open',
          400,
        );
      }

      /*
       * Claim otimista.
       *
       * Evita dois pedidos de reembolso
       * alterarem a mesma compra ao mesmo
       * tempo.
       */
      const claim =
        await tx.creditCardInstallmentPurchase.updateMany({
          where: {
            id:
              installmentPurchase.id,
            workspaceId:
              input.workspaceId,
            status: 'ACTIVE',
            updatedAt:
              installmentPurchase.updatedAt,
          },
          data: {
            status: 'REFUNDED',
          },
        });

      if (
        claim.count !== 1
      ) {
        throw new AppError(
          'Installment purchase changed, try again',
          409,
        );
      }

      /*
       * Parcelas ainda pertencentes a
       * faturas OPEN não devem continuar
       * sendo cobradas depois do reembolso.
       *
       * Elas ficam VOIDED e são retiradas
       * dos totais das respectivas faturas.
       */
      for (
        const installment of
          openInstallments
      ) {
        await tx.financialTransaction.update({
          where: {
            id:
              installment.transactionId,
          },
          data: {
            status: 'VOIDED',
          },
        });

        await tx.creditCardInvoice.update({
          where: {
            id:
              installment.invoiceId,
          },
          data: {
            totalAmount: {
              decrement:
                installment.amount,
            },
          },
        });
      }

      /*
       * Somente as parcelas que já fazem
       * parte de faturas históricas precisam
       * gerar crédito.
       *
       * As parcelas OPEN já foram anuladas,
       * portanto creditá-las novamente
       * liberaria limite duas vezes.
       */
      const refundTransaction =
        await tx.financialTransaction.create({
          data: {
            workspaceId:
              input.workspaceId,
            categoryId: null,
            invoiceId: null,
            installmentPurchaseId:
              null,
            installmentNumber:
              null,
            refundForInstallmentPurchaseId:
              installmentPurchase.id,
            type: 'REFUND',
            status: 'POSTED',
            description:
              `Reembolso: ${installmentPurchase.description}`,
            transactionDate:
              input.refundDate,
          },
        });

      await tx.ledgerEntry.create({
        data: {
          transactionId:
            refundTransaction.id,
          accountId:
            installmentPurchase
              .creditCard
              .accountId,
          type: 'CREDIT',
          amount:
            historicalAmount,
        },
      });

      const result =
        await tx.creditCardInstallmentPurchase.findUnique({
          where: {
            id:
              installmentPurchase.id,
          },
          include: {
            creditCard: {
              include: {
                account: true,
              },
            },
            category: true,
            transactions: {
              include: {
                invoice: true,
                entries: true,
              },
              orderBy: {
                installmentNumber:
                  'asc',
              },
            },
            refundTransaction: {
              include: {
                entries: true,
              },
            },
          },
        });

      if (!result) {
        throw new AppError(
          'Installment purchase not found',
          404,
        );
      }

      return {
        installmentPurchase:
          result,
        refundAmount:
          historicalAmount,
        cancelledOpenInstallments:
          openInstallments.length,
      };
    },
  );
}