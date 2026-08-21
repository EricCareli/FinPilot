import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface CreateRecurringTransactionInput {
  workspaceId: string;
  accountId: string;
  categoryId?: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  frequency:
    | 'DAILY'
    | 'WEEKLY'
    | 'MONTHLY'
    | 'YEARLY';
  startDate: Date;
  endDate?: Date;
}

function calculateNextRunDate(
  date: Date,
  frequency:
    | 'DAILY'
    | 'WEEKLY'
    | 'MONTHLY'
    | 'YEARLY',
) {
  const nextDate = new Date(date);

  switch (frequency) {
    case 'DAILY':
      nextDate.setDate(
        nextDate.getDate() + 1,
      );
      break;

    case 'WEEKLY':
      nextDate.setDate(
        nextDate.getDate() + 7,
      );
      break;

    case 'MONTHLY': {
      const originalDay =
        nextDate.getDate();

      nextDate.setDate(1);
      nextDate.setMonth(
        nextDate.getMonth() + 1,
      );

      const lastDayOfMonth =
        new Date(
          nextDate.getFullYear(),
          nextDate.getMonth() + 1,
          0,
        ).getDate();

      nextDate.setDate(
        Math.min(
          originalDay,
          lastDayOfMonth,
        ),
      );

      break;
    }

    case 'YEARLY': {
      const originalMonth =
        nextDate.getMonth();

      const originalDay =
        nextDate.getDate();

      nextDate.setDate(1);
      nextDate.setFullYear(
        nextDate.getFullYear() + 1,
      );
      nextDate.setMonth(
        originalMonth,
      );

      const lastDayOfMonth =
        new Date(
          nextDate.getFullYear(),
          originalMonth + 1,
          0,
        ).getDate();

      nextDate.setDate(
        Math.min(
          originalDay,
          lastDayOfMonth,
        ),
      );

      break;
    }
  }

  return nextDate;
}

export async function createRecurringTransaction(
  input: CreateRecurringTransactionInput,
) {
  if (
    input.type !== 'INCOME' &&
    input.type !== 'EXPENSE'
  ) {
    throw new Error(
      'Recurring transaction type must be INCOME or EXPENSE',
    );
  }

  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    throw new Error(
      'Recurring transaction amount must be greater than zero',
    );
  }

  const normalizedDescription =
    input.description.trim();

  if (!normalizedDescription) {
    throw new Error(
      'Description is required',
    );
  }

  if (
    Number.isNaN(
      input.startDate.getTime(),
    )
  ) {
    throw new Error(
      'Invalid start date',
    );
  }

  if (
    input.endDate &&
    Number.isNaN(
      input.endDate.getTime(),
    )
  ) {
    throw new Error(
      'Invalid end date',
    );
  }

  if (
    input.endDate &&
    input.endDate < input.startDate
  ) {
    throw new Error(
      'End date must be greater than or equal to start date',
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const account =
        await tx.account.findFirst({
          where: {
            id: input.accountId,
            workspaceId:
              input.workspaceId,
            status: 'ACTIVE',
          },
        });

      if (!account) {
        throw new Error(
          'Account not found',
        );
      }

      if (
        account.type ===
        'CREDIT_CARD'
      ) {
        throw new Error(
          'Recurring transactions cannot use credit card accounts',
        );
      }

      if (input.categoryId) {
        const category =
          await tx.category.findFirst({
            where: {
              id: input.categoryId,
              workspaceId:
                input.workspaceId,
            },
          });

        if (!category) {
          throw new Error(
            'Category not found',
          );
        }

        if (
          category.type !==
          input.type
        ) {
          throw new Error(
            'Category type must match recurring transaction type',
          );
        }
      }

      const amount =
        new Prisma.Decimal(
          input.amount,
        );

      return tx.recurringTransaction.create(
        {
          data: {
            workspaceId:
              input.workspaceId,
            accountId:
              input.accountId,
            categoryId:
              input.categoryId ??
              null,
            type: input.type,
            amount,
            description:
              normalizedDescription,
            frequency:
              input.frequency,
            startDate:
              input.startDate,
            endDate:
              input.endDate ?? null,
            nextRunDate:
              input.startDate,
            status: 'ACTIVE',
          },
        },
      );
    },
  );
}

export async function listRecurringTransactions(
  workspaceId: string,
) {
  return prisma.recurringTransaction.findMany(
    {
      where: {
        workspaceId,
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        account: true,
        category: true,
      },
      orderBy: {
        nextRunDate: 'asc',
      },
    },
  );
}

export async function executeRecurringTransaction(
  workspaceId: string,
  recurringTransactionId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const recurringTransaction =
        await tx.recurringTransaction.findFirst(
          {
            where: {
              id: recurringTransactionId,
              workspaceId,
            },
          },
        );

      if (!recurringTransaction) {
        throw new Error(
          'Recurring transaction not found',
        );
      }

      if (
        recurringTransaction.status !==
        'ACTIVE'
      ) {
        throw new Error(
          'Recurring transaction is not active',
        );
      }

      const account =
        await tx.account.findFirst({
          where: {
            id:
              recurringTransaction.accountId,
            workspaceId,
            status: 'ACTIVE',
          },
        });

      if (!account) {
        throw new Error(
          'Account not found',
        );
      }

      if (
        account.type ===
        'CREDIT_CARD'
      ) {
        throw new Error(
          'Recurring transactions cannot use credit card accounts',
        );
      }

      const now = new Date();

      if (
        recurringTransaction.nextRunDate >
        now
      ) {
        throw new Error(
          'Recurring transaction is not due yet',
        );
      }

      const transaction =
        await tx.financialTransaction.create(
          {
            data: {
              workspaceId,
              categoryId:
                recurringTransaction.categoryId,
              type:
                recurringTransaction.type,
              status: 'POSTED',
              description:
                recurringTransaction.description,
              transactionDate:
                recurringTransaction.nextRunDate,
            },
          },
        );

      const ledgerEntryType =
        recurringTransaction.type ===
        'INCOME'
          ? 'CREDIT'
          : 'DEBIT';

      await tx.ledgerEntry.create({
        data: {
          transactionId:
            transaction.id,
          accountId:
            account.id,
          type: ledgerEntryType,
          amount:
            recurringTransaction.amount,
        },
      });

      const nextRunDate =
        calculateNextRunDate(
          recurringTransaction.nextRunDate,
          recurringTransaction.frequency,
        );

      if (
        recurringTransaction.endDate &&
        nextRunDate >
          recurringTransaction.endDate
      ) {
        await tx.recurringTransaction.update(
          {
            where: {
              id:
                recurringTransaction.id,
            },
            data: {
              nextRunDate,
              status: 'CANCELLED',
            },
          },
        );

        return {
          transaction,
          recurringTransaction: {
            id:
              recurringTransaction.id,
            nextRunDate,
            status:
              'CANCELLED' as const,
          },
        };
      }

      const updatedRecurringTransaction =
        await tx.recurringTransaction.update(
          {
            where: {
              id:
                recurringTransaction.id,
            },
            data: {
              nextRunDate,
            },
          },
        );

      return {
        transaction,
        recurringTransaction:
          updatedRecurringTransaction,
      };
    },
  );
}

export async function pauseRecurringTransaction(
  workspaceId: string,
  recurringTransactionId: string,
) {
  const recurringTransaction =
    await prisma.recurringTransaction.findFirst(
      {
        where: {
          id: recurringTransactionId,
          workspaceId,
        },
      },
    );

  if (!recurringTransaction) {
    throw new Error(
      'Recurring transaction not found',
    );
  }

  if (
    recurringTransaction.status ===
    'CANCELLED'
  ) {
    throw new Error(
      'Cancelled recurring transaction cannot be paused',
    );
  }

  if (
    recurringTransaction.status ===
    'PAUSED'
  ) {
    throw new Error(
      'Recurring transaction is already paused',
    );
  }

  return prisma.recurringTransaction.update(
    {
      where: {
        id: recurringTransactionId,
      },
      data: {
        status: 'PAUSED',
      },
    },
  );
}

export async function resumeRecurringTransaction(
  workspaceId: string,
  recurringTransactionId: string,
) {
  const recurringTransaction =
    await prisma.recurringTransaction.findFirst(
      {
        where: {
          id: recurringTransactionId,
          workspaceId,
        },
      },
    );

  if (!recurringTransaction) {
    throw new Error(
      'Recurring transaction not found',
    );
  }

  if (
    recurringTransaction.status ===
    'CANCELLED'
  ) {
    throw new Error(
      'Cancelled recurring transaction cannot be resumed',
    );
  }

  if (
    recurringTransaction.status ===
    'ACTIVE'
  ) {
    throw new Error(
      'Recurring transaction is already active',
    );
  }

  return prisma.recurringTransaction.update(
    {
      where: {
        id: recurringTransactionId,
      },
      data: {
        status: 'ACTIVE',
      },
    },
  );
}

export async function cancelRecurringTransaction(
  workspaceId: string,
  recurringTransactionId: string,
) {
  const recurringTransaction =
    await prisma.recurringTransaction.findFirst(
      {
        where: {
          id: recurringTransactionId,
          workspaceId,
        },
      },
    );

  if (!recurringTransaction) {
    throw new Error(
      'Recurring transaction not found',
    );
  }

  if (
    recurringTransaction.status ===
    'CANCELLED'
  ) {
    throw new Error(
      'Recurring transaction is already cancelled',
    );
  }

  return prisma.recurringTransaction.update(
    {
      where: {
        id: recurringTransactionId,
      },
      data: {
        status: 'CANCELLED',
      },
    },
  );
}