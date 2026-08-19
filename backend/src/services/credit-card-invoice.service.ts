import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface CreateInvoiceInput {
  workspaceId: string;
  accountId: string;
  month: number;
  year: number;
}

function getInvoiceDates(
  closingDay: number,
  dueDay: number,
  month: number,
  year: number,
) {
  const closingDate = new Date(
    Date.UTC(year, month - 1, closingDay),
  );

  let dueYear = year;
  let dueMonth = month;

  if (dueDay <= closingDay) {
    dueMonth += 1;

    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear += 1;
    }
  }

  const dueDate = new Date(
    Date.UTC(dueYear, dueMonth - 1, dueDay),
  );

  const periodStart = new Date(
    Date.UTC(year, month - 2, closingDay + 1),
  );

  const periodEnd = new Date(
    Date.UTC(year, month - 1, closingDay + 1),
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
      throw new Error('Credit card not found');
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
          creditCardId_referenceMonth_referenceYear: {
            creditCardId: creditCard.id,
            referenceMonth: input.month,
            referenceYear: input.year,
          },
        },
      });

    if (existingInvoice) {
      throw new Error('Invoice already exists');
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

    let totalAmount = new Prisma.Decimal(0);

    for (const transaction of transactions) {
      for (const entry of transaction.entries) {
        totalAmount = totalAmount.plus(entry.amount);
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