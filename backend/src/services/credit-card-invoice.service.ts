import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface CreateInvoiceInput {
  workspaceId: string;
  accountId: string;
  month: number;
  year: number;
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
    getLastDayOfMonth(year, month),
  );

  return new Date(
    Date.UTC(year, month - 1, safeDay),
  );
}

function getInvoiceDates(
  closingDay: number,
  dueDay: number,
  month: number,
  year: number,
) {
  const closingDate = createSafeDate(
    year,
    month,
    closingDay,
  );

  let previousMonth = month - 1;
  let previousYear = year;

  if (previousMonth < 1) {
    previousMonth = 12;
    previousYear -= 1;
  }

  const periodStart = new Date(
    Date.UTC(
      previousYear,
      previousMonth - 1,
      Math.min(
        closingDay + 1,
        getLastDayOfMonth(
          previousYear,
          previousMonth,
        ),
      ),
    ),
  );

  const periodEnd = new Date(
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

  const dueDate = createSafeDate(
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

export async function createInvoice(
  input: CreateInvoiceInput,
) {
  return prisma.$transaction(async (tx) => {
    const creditCard =
      await tx.creditCard.findFirst({
        where: {
          accountId: input.accountId,
          account: {
            workspaceId: input.workspaceId,
            status: 'ACTIVE',
            type: 'CREDIT_CARD',
          },
        },
      });

    if (!creditCard) {
      throw new Error(
        'Credit card not found',
      );
    }

    if (
      !Number.isInteger(input.month) ||
      input.month < 1 ||
      input.month > 12
    ) {
      throw new Error('Invalid month');
    }

    if (
      !Number.isInteger(input.year) ||
      input.year < 2000
    ) {
      throw new Error('Invalid year');
    }

    const existingInvoice =
      await tx.creditCardInvoice.findUnique({
        where: {
          creditCardId_referenceMonth_referenceYear:
            {
              creditCardId: creditCard.id,
              referenceMonth: input.month,
              referenceYear: input.year,
            },
        },
      });

    if (existingInvoice) {
      throw new Error(
        'Invoice already exists',
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
          workspaceId: input.workspaceId,
          type: 'EXPENSE',
          status: 'POSTED',
          transactionDate: {
            gte: periodStart,
            lt: periodEnd,
          },
          entries: {
            some: {
              accountId: input.accountId,
              type: 'DEBIT',
            },
          },
        },
        include: {
          entries: {
            where: {
              accountId: input.accountId,
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

    for (const transaction of transactions) {
      for (const entry of transaction.entries) {
        totalAmount = totalAmount.plus(
          entry.amount,
        );
      }
    }

    return tx.creditCardInvoice.create({
      data: {
        creditCardId: creditCard.id,
        referenceMonth: input.month,
        referenceYear: input.year,
        closingDate,
        dueDate,
        totalAmount,
        status: 'OPEN',
      },
    });
  });
}

export async function listInvoices(
  workspaceId: string,
  accountId: string,
) {
  return prisma.creditCardInvoice.findMany({
    where: {
      creditCard: {
        accountId,
        account: {
          workspaceId,
          status: 'ACTIVE',
        },
      },
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