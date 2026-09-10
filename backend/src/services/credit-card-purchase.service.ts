import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface CreateCreditCardPurchaseInput {
  workspaceId: string;
  accountId: string;
  categoryId?: string;
  amount: number;
  description: string;
  transactionDate: Date;
}

function getLastDayOfMonth(
  year: number,
  month: number,
): number {
  return new Date(
    Date.UTC(year, month, 0),
  ).getUTCDate();
}

function createSafeDate(
  year: number,
  month: number,
  day: number,
): Date {
  const safeDay = Math.min(
    day,
    getLastDayOfMonth(
      year,
      month,
    ),
  );

  return new Date(
    Date.UTC(
      year,
      month - 1,
      safeDay,
    ),
  );
}

function getInvoiceReference(
  closingDay: number,
  transactionDate: Date,
) {
  const transactionYear =
    transactionDate.getUTCFullYear();

  const transactionMonth =
    transactionDate.getUTCMonth() + 1;

  const transactionDay =
    transactionDate.getUTCDate();

  if (
    transactionDay <=
    closingDay
  ) {
    return {
      month:
        transactionMonth,
      year:
        transactionYear,
    };
  }

  let nextMonth =
    transactionMonth + 1;

  let nextYear =
    transactionYear;

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  return {
    month: nextMonth,
    year: nextYear,
  };
}

function getInvoiceDates(
  closingDay: number,
  dueDay: number,
  month: number,
  year: number,
) {
  const closingDate =
    createSafeDate(
      year,
      month,
      closingDay,
    );

  let dueMonth = month;
  let dueYear = year;

  if (dueDay <= closingDay) {
    dueMonth += 1;

    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear += 1;
    }
  }

  const dueDate =
    createSafeDate(
      dueYear,
      dueMonth,
      dueDay,
    );

  return {
    closingDate,
    dueDate,
  };
}

export async function createCreditCardPurchase(
  input: CreateCreditCardPurchaseInput,
) {
  return prisma.$transaction(
    async (tx) => {
      const creditCard =
        await tx.creditCard.findFirst({
          where: {
            accountId:
              input.accountId,
            account: {
              workspaceId:
                input.workspaceId,
              status: 'ACTIVE',
              type: 'CREDIT_CARD',
            },
          },
        });

      if (!creditCard) {
        throw new AppError(
          'Credit card not found',
          404,
        );
      }

      if (
        !Number.isFinite(
          input.amount,
        ) ||
        input.amount <= 0
      ) {
        throw new AppError(
          'Purchase amount must be greater than zero',
          400,
        );
      }

      const description =
        input.description.trim();

      if (!description) {
        throw new AppError(
          'Description is required',
          400,
        );
      }

      if (
        Number.isNaN(
          input.transactionDate.getTime(),
        )
      ) {
        throw new AppError(
          'Invalid transaction date',
          400,
        );
      }

      if (input.categoryId) {
        const category =
          await tx.category.findFirst({
            where: {
              id: input.categoryId,
              workspaceId:
                input.workspaceId,
              type: 'EXPENSE',
            },
          });

        if (!category) {
          throw new AppError(
            'Category not found',
            404,
          );
        }
      }

      const entries =
        await tx.ledgerEntry.findMany({
          where: {
            accountId:
              input.accountId,
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

      let usedLimit =
        new Prisma.Decimal(0);

      for (const entry of entries) {
        if (
          entry.type === 'DEBIT'
        ) {
          usedLimit =
            usedLimit.plus(
              entry.amount,
            );
        } else {
          usedLimit =
            usedLimit.minus(
              entry.amount,
            );
        }
      }

      if (usedLimit.isNegative()) {
        usedLimit =
          new Prisma.Decimal(0);
      }

      const creditLimit =
        new Prisma.Decimal(
          creditCard.creditLimit,
        );

      const purchaseAmount =
        new Prisma.Decimal(
          input.amount,
        );

      const availableLimit =
        creditLimit.minus(
          usedLimit,
        );

      if (
        purchaseAmount.gt(
          availableLimit,
        )
      ) {
        throw new AppError(
          'Insufficient credit limit',
          400,
        );
      }

      const {
        month,
        year,
      } = getInvoiceReference(
        creditCard.closingDay,
        input.transactionDate,
      );

      let invoice =
        await tx.creditCardInvoice.findUnique({
          where: {
            creditCardId_referenceMonth_referenceYear:
              {
                creditCardId:
                  creditCard.id,
                referenceMonth:
                  month,
                referenceYear:
                  year,
              },
          },
        });

      if (
        invoice &&
        invoice.status ===
          'PAID'
      ) {
        throw new AppError(
          'Invoice for this purchase cycle is already paid',
          400,
        );
      }

      if (!invoice) {
        const {
          closingDate,
          dueDate,
        } = getInvoiceDates(
          creditCard.closingDay,
          creditCard.dueDay,
          month,
          year,
        );

        invoice =
          await tx.creditCardInvoice.create({
            data: {
              creditCardId:
                creditCard.id,
              referenceMonth:
                month,
              referenceYear:
                year,
              closingDate,
              dueDate,
              totalAmount:
                new Prisma.Decimal(
                  0,
                ),
              status: 'OPEN',
            },
          });
      }

      if (
        invoice.status !==
        'OPEN'
      ) {
        throw new AppError(
          'Invoice is not open',
          400,
        );
      }

      const transaction =
        await tx.financialTransaction.create({
          data: {
            workspaceId:
              input.workspaceId,
            categoryId:
              input.categoryId ??
              null,
            invoiceId:
              invoice.id,
            type: 'EXPENSE',
            status: 'POSTED',
            description,
            transactionDate:
              input.transactionDate,
          },
        });

      await tx.ledgerEntry.create({
        data: {
          transactionId:
            transaction.id,
          accountId:
            input.accountId,
          type: 'DEBIT',
          amount:
            purchaseAmount,
        },
      });

      const updatedInvoice =
        await tx.creditCardInvoice.update({
          where: {
            id: invoice.id,
          },
          data: {
            totalAmount: {
              increment:
                purchaseAmount,
            },
          },
        });

      return {
        transaction,
        invoice:
          updatedInvoice,
      };
    },
  );
}