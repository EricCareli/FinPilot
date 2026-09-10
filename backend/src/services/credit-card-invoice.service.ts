import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface CreateInvoiceInput {
  workspaceId: string;
  accountId: string;
  month: number;
  year: number;
}

export interface CloseInvoiceInput {
  workspaceId: string;
  invoiceId: string;
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

function getStartOfTodayUtc(): Date {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
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

  let previousMonth =
    month - 1;

  let previousYear =
    year;

  if (previousMonth < 1) {
    previousMonth = 12;
    previousYear -= 1;
  }

  const previousClosingDate =
    createSafeDate(
      previousYear,
      previousMonth,
      closingDay,
    );

  const periodStart =
    new Date(
      previousClosingDate.getTime(),
    );

  periodStart.setUTCDate(
    periodStart.getUTCDate() + 1,
  );

  const periodEnd =
    new Date(
      closingDate.getTime(),
    );

  periodEnd.setUTCDate(
    periodEnd.getUTCDate() + 1,
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
    periodStart,
    periodEnd,
  };
}

async function markOverdueInvoices(
  creditCardId: string,
) {
  const today =
    getStartOfTodayUtc();

  await prisma.creditCardInvoice.updateMany({
    where: {
      creditCardId,
      status: 'CLOSED',
      dueDate: {
        lt: today,
      },
      totalAmount: {
        gt: new Prisma.Decimal(0),
      },
    },
    data: {
      status: 'OVERDUE',
    },
  });
}

export async function createInvoice(
  input: CreateInvoiceInput,
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
        !Number.isInteger(
          input.month,
        ) ||
        input.month < 1 ||
        input.month > 12
      ) {
        throw new AppError(
          'Invalid month',
          400,
        );
      }

      if (
        !Number.isInteger(
          input.year,
        ) ||
        input.year < 2000
      ) {
        throw new AppError(
          'Invalid year',
          400,
        );
      }

      const existingInvoice =
        await tx.creditCardInvoice.findUnique({
          where: {
            creditCardId_referenceMonth_referenceYear:
              {
                creditCardId:
                  creditCard.id,
                referenceMonth:
                  input.month,
                referenceYear:
                  input.year,
              },
          },
        });

      if (existingInvoice) {
        throw new AppError(
          'Invoice already exists',
          409,
        );
      }

      const {
        closingDate,
        dueDate,
        periodStart,
        periodEnd,
      } = getInvoiceDates(
        creditCard.closingDay,
        creditCard.dueDay,
        input.month,
        input.year,
      );

      const transactions =
        await tx.financialTransaction.findMany({
          where: {
            workspaceId:
              input.workspaceId,
            invoiceId: null,
            type: 'EXPENSE',
            status: 'POSTED',
            transactionDate: {
              gte: periodStart,
              lt: periodEnd,
            },
            entries: {
              some: {
                accountId:
                  input.accountId,
                type: 'DEBIT',
              },
            },
          },
          include: {
            entries: {
              where: {
                accountId:
                  input.accountId,
                type: 'DEBIT',
              },
              select: {
                amount: true,
              },
            },
          },
        });

      let totalAmount =
        new Prisma.Decimal(0);

      for (
        const transaction
        of transactions
      ) {
        for (
          const entry
          of transaction.entries
        ) {
          totalAmount =
            totalAmount.plus(
              entry.amount,
            );
        }
      }

      const invoice =
        await tx.creditCardInvoice.create({
          data: {
            creditCardId:
              creditCard.id,
            referenceMonth:
              input.month,
            referenceYear:
              input.year,
            closingDate,
            dueDate,
            totalAmount,
            status: 'OPEN',
          },
        });

      const transactionIds =
        transactions.map(
          (transaction) =>
            transaction.id,
        );

      if (
        transactionIds.length > 0
      ) {
        await tx.financialTransaction.updateMany({
          where: {
            id: {
              in:
                transactionIds,
            },
            workspaceId:
              input.workspaceId,
            invoiceId: null,
          },
          data: {
            invoiceId:
              invoice.id,
          },
        });
      }

      return invoice;
    },
  );
}

export async function closeCreditCardInvoice(
  input: CloseInvoiceInput,
) {
  return prisma.$transaction(
    async (tx) => {
      const invoice =
        await tx.creditCardInvoice.findFirst({
          where: {
            id:
              input.invoiceId,
            creditCard: {
              account: {
                workspaceId:
                  input.workspaceId,
                status: 'ACTIVE',
                type: 'CREDIT_CARD',
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
        invoice.status === 'PAID'
      ) {
        throw new AppError(
          'Paid invoices cannot be closed',
          400,
        );
      }

      if (
        invoice.status === 'CLOSED' ||
        invoice.status === 'OVERDUE'
      ) {
        throw new AppError(
          'Invoice is already closed',
          400,
        );
      }

      if (
        invoice.status !== 'OPEN'
      ) {
        throw new AppError(
          'Invoice cannot be closed',
          400,
        );
      }

      const entries =
        await tx.ledgerEntry.findMany({
          where: {
            accountId:
              invoice.creditCard.accountId,
            type: 'DEBIT',
            transaction: {
              workspaceId:
                input.workspaceId,
              invoiceId:
                invoice.id,
              status: 'POSTED',
              type: 'EXPENSE',
            },
          },
          select: {
            amount: true,
          },
        });

      let totalAmount =
        new Prisma.Decimal(0);

      for (const entry of entries) {
        totalAmount =
          totalAmount.plus(
            entry.amount,
          );
      }

      const today =
        getStartOfTodayUtc();

      const status =
        invoice.dueDate < today &&
        totalAmount.gt(0)
          ? 'OVERDUE'
          : 'CLOSED';

      return tx.creditCardInvoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          totalAmount,
          status,
        },
      });
    },
  );
}

export async function listInvoices(
  workspaceId: string,
  accountId: string,
) {
  const creditCard =
    await prisma.creditCard.findFirst({
      where: {
        accountId,
        account: {
          workspaceId,
          status: 'ACTIVE',
          type: 'CREDIT_CARD',
        },
      },
      select: {
        id: true,
      },
    });

  if (!creditCard) {
    throw new AppError(
      'Credit card not found',
      404,
    );
  }

  await markOverdueInvoices(
    creditCard.id,
  );

  return prisma.creditCardInvoice.findMany({
    where: {
      creditCardId:
        creditCard.id,
    },
    orderBy: [
      {
        referenceYear: 'desc',
      },
      {
        referenceMonth: 'desc',
      },
    ],
  });
}