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

export interface UpdateCreditCardPurchaseInput {
  workspaceId: string;
  transactionId: string;
  categoryId?: string | null;
  amount?: number;
  description?: string;
  transactionDate?: Date;
}

export interface VoidCreditCardPurchaseInput {
  workspaceId: string;
  transactionId: string;
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
        invoice.status === 'PAID'
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
                new Prisma.Decimal(0),
              status: 'OPEN',
            },
          });
      }

      if (
        invoice.status !== 'OPEN'
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

export async function updateCreditCardPurchase(
  input: UpdateCreditCardPurchaseInput,
) {
  if (
    input.categoryId === undefined &&
    input.amount === undefined &&
    input.description === undefined &&
    input.transactionDate === undefined
  ) {
    throw new AppError(
      'At least one purchase field must be provided',
      400,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const transaction =
        await tx.financialTransaction.findFirst({
          where: {
            id:
              input.transactionId,
            workspaceId:
              input.workspaceId,
          },
          include: {
            invoice: true,
            entries: {
              include: {
                account: true,
              },
            },
          },
        });

      if (!transaction) {
        throw new AppError(
          'Purchase not found',
          404,
        );
      }

      if (
        transaction.status ===
        'VOIDED'
      ) {
        throw new AppError(
          'Voided purchases cannot be edited',
          400,
        );
      }

      if (
        transaction.status !==
          'POSTED' ||
        transaction.type !==
          'EXPENSE'
      ) {
        throw new AppError(
          'Transaction is not an editable credit card purchase',
          400,
        );
      }

      if (
        transaction.entries.length !==
        1
      ) {
        throw new AppError(
          'Purchase ledger is inconsistent',
          409,
        );
      }

      const currentEntry =
        transaction.entries[0];

      if (
        !currentEntry ||
        currentEntry.type !==
          'DEBIT' ||
        currentEntry.account.type !==
          'CREDIT_CARD'
      ) {
        throw new AppError(
          'Transaction is not a credit card purchase',
          400,
        );
      }

      const creditCard =
        await tx.creditCard.findFirst({
          where: {
            accountId:
              currentEntry.accountId,
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
        transaction.invoice &&
        transaction.invoice
          .creditCardId !==
          creditCard.id
      ) {
        throw new AppError(
          'Purchase invoice is inconsistent',
          409,
        );
      }

      if (
        transaction.invoice &&
        transaction.invoice.status !==
          'OPEN'
      ) {
        throw new AppError(
          'Only purchases from an open invoice can be edited',
          400,
        );
      }

      const nextCategoryId =
        input.categoryId !==
        undefined
          ? input.categoryId
          : transaction.categoryId;

      if (
        nextCategoryId !== null
      ) {
        const category =
          await tx.category.findFirst({
            where: {
              id:
                nextCategoryId,
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

      let nextAmount =
        new Prisma.Decimal(
          currentEntry.amount,
        );

      if (
        input.amount !== undefined
      ) {
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

        nextAmount =
          new Prisma.Decimal(
            input.amount,
          );
      }

      let nextDescription =
        transaction.description;

      if (
        input.description !==
        undefined
      ) {
        nextDescription =
          input.description.trim();

        if (!nextDescription) {
          throw new AppError(
            'Description is required',
            400,
          );
        }
      }

      const nextTransactionDate =
        input.transactionDate ??
        transaction.transactionDate;

      if (
        Number.isNaN(
          nextTransactionDate.getTime(),
        )
      ) {
        throw new AppError(
          'Invalid transaction date',
          400,
        );
      }

      const entries =
        await tx.ledgerEntry.findMany({
          where: {
            accountId:
              currentEntry.accountId,
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

      const projectedUsedLimit =
        usedLimit
          .minus(
            currentEntry.amount,
          )
          .plus(nextAmount);

      const creditLimit =
        new Prisma.Decimal(
          creditCard.creditLimit,
        );

      if (
        projectedUsedLimit.gt(
          creditLimit,
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
        nextTransactionDate,
      );

      let targetInvoice =
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
        targetInvoice &&
        targetInvoice.status ===
          'PAID'
      ) {
        throw new AppError(
          'Invoice for this purchase cycle is already paid',
          400,
        );
      }

      if (
        targetInvoice &&
        targetInvoice.status !==
          'OPEN'
      ) {
        throw new AppError(
          'Invoice is not open',
          400,
        );
      }

      if (!targetInvoice) {
        const {
          closingDate,
          dueDate,
        } = getInvoiceDates(
          creditCard.closingDay,
          creditCard.dueDay,
          month,
          year,
        );

        targetInvoice =
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
                new Prisma.Decimal(0),
              status: 'OPEN',
            },
          });
      }

      const currentAmount =
        new Prisma.Decimal(
          currentEntry.amount,
        );

      if (
        transaction.invoice
      ) {
        if (
          transaction.invoice.id ===
          targetInvoice.id
        ) {
          const difference =
            nextAmount.minus(
              currentAmount,
            );

          if (!difference.isZero()) {
            const nextInvoiceTotal =
              new Prisma.Decimal(
                transaction.invoice
                  .totalAmount,
              ).plus(difference);

            if (
              nextInvoiceTotal.isNegative()
            ) {
              throw new AppError(
                'Purchase invoice is inconsistent',
                409,
              );
            }

            await tx.creditCardInvoice.update({
              where: {
                id:
                  targetInvoice.id,
              },
              data: {
                totalAmount:
                  nextInvoiceTotal,
              },
            });
          }
        } else {
          const oldInvoiceTotal =
            new Prisma.Decimal(
              transaction.invoice
                .totalAmount,
            );

          if (
            oldInvoiceTotal.lt(
              currentAmount,
            )
          ) {
            throw new AppError(
              'Purchase invoice is inconsistent',
              409,
            );
          }

          await tx.creditCardInvoice.update({
            where: {
              id:
                transaction.invoice.id,
            },
            data: {
              totalAmount:
                oldInvoiceTotal.minus(
                  currentAmount,
                ),
            },
          });

          await tx.creditCardInvoice.update({
            where: {
              id:
                targetInvoice.id,
            },
            data: {
              totalAmount: {
                increment:
                  nextAmount,
              },
            },
          });
        }
      } else {
        await tx.creditCardInvoice.update({
          where: {
            id:
              targetInvoice.id,
          },
          data: {
            totalAmount: {
              increment:
                nextAmount,
            },
          },
        });
      }

      await tx.financialTransaction.update({
        where: {
          id:
            transaction.id,
        },
        data: {
          categoryId:
            nextCategoryId,
          invoiceId:
            targetInvoice.id,
          description:
            nextDescription,
          transactionDate:
            nextTransactionDate,
        },
      });

      await tx.ledgerEntry.update({
        where: {
          id:
            currentEntry.id,
        },
        data: {
          amount:
            nextAmount,
        },
      });

      return tx.financialTransaction.findUnique({
        where: {
          id:
            transaction.id,
        },
        include: {
          category: true,
          invoice: true,
          entries: {
            include: {
              account: true,
            },
          },
        },
      });
    },
  );
}

export async function voidCreditCardPurchase(
  input: VoidCreditCardPurchaseInput,
) {
  return prisma.$transaction(
    async (tx) => {
      const transaction =
        await tx.financialTransaction.findFirst({
          where: {
            id:
              input.transactionId,
            workspaceId:
              input.workspaceId,
          },
          include: {
            invoice: true,
            entries: {
              include: {
                account: true,
              },
            },
          },
        });

      if (!transaction) {
        throw new AppError(
          'Purchase not found',
          404,
        );
      }

      if (
        transaction.status ===
        'VOIDED'
      ) {
        throw new AppError(
          'Purchase is already voided',
          400,
        );
      }

      if (
        transaction.status !==
          'POSTED' ||
        transaction.type !==
          'EXPENSE'
      ) {
        throw new AppError(
          'Transaction is not a voidable credit card purchase',
          400,
        );
      }

      if (
        transaction.entries.length !==
        1
      ) {
        throw new AppError(
          'Purchase ledger is inconsistent',
          409,
        );
      }

      const currentEntry =
        transaction.entries[0];

      if (
        !currentEntry ||
        currentEntry.type !==
          'DEBIT' ||
        currentEntry.account.type !==
          'CREDIT_CARD'
      ) {
        throw new AppError(
          'Transaction is not a credit card purchase',
          400,
        );
      }

      const creditCard =
        await tx.creditCard.findFirst({
          where: {
            accountId:
              currentEntry.accountId,
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
        transaction.invoice &&
        transaction.invoice
          .creditCardId !==
          creditCard.id
      ) {
        throw new AppError(
          'Purchase invoice is inconsistent',
          409,
        );
      }

      if (
        transaction.invoice &&
        transaction.invoice.status !==
          'OPEN'
      ) {
        throw new AppError(
          'Only purchases from an open invoice can be voided',
          400,
        );
      }

      if (
        transaction.invoice
      ) {
        const invoiceTotal =
          new Prisma.Decimal(
            transaction.invoice
              .totalAmount,
          );

        if (
          invoiceTotal.lt(
            currentEntry.amount,
          )
        ) {
          throw new AppError(
            'Purchase invoice is inconsistent',
            409,
          );
        }

        await tx.creditCardInvoice.update({
          where: {
            id:
              transaction.invoice.id,
          },
          data: {
            totalAmount:
              invoiceTotal.minus(
                currentEntry.amount,
              ),
          },
        });
      }

      return tx.financialTransaction.update({
        where: {
          id:
            transaction.id,
        },
        data: {
          status: 'VOIDED',
        },
        include: {
          category: true,
          invoice: true,
          entries: {
            include: {
              account: true,
            },
          },
        },
      });
    },
  );
}