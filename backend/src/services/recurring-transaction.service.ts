import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

type RecurringFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY';

type RecurringTransactionType =
  | 'INCOME'
  | 'EXPENSE';

export interface CreateRecurringTransactionInput {
  workspaceId: string;
  accountId: string;
  categoryId?: string;
  type: RecurringTransactionType;
  amount: number;
  description: string;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date;
}

export interface UpdateRecurringTransactionInput {
  workspaceId: string;
  recurringTransactionId: string;
  accountId?: string;
  categoryId?: string | null;
  type?: RecurringTransactionType;
  amount?: number;
  description?: string;
  frequency?: RecurringFrequency;
  nextRunDate?: Date;
  endDate?: Date | null;
}

function validateRecurringTransactionType(
  type: string,
): asserts type is RecurringTransactionType {
  if (
    type !== 'INCOME' &&
    type !== 'EXPENSE'
  ) {
    throw new AppError(
      'Recurring transaction type must be INCOME or EXPENSE',
      400,
    );
  }
}

function validateRecurringFrequency(
  frequency: string,
): asserts frequency is RecurringFrequency {
  if (
    frequency !== 'DAILY' &&
    frequency !== 'WEEKLY' &&
    frequency !== 'MONTHLY' &&
    frequency !== 'YEARLY'
  ) {
    throw new AppError(
      'Invalid frequency',
      400,
    );
  }
}

function calculateNextRunDate(
  date: Date,
  frequency: RecurringFrequency,
): Date {
  const nextDate =
    new Date(date.getTime());

  switch (frequency) {
    case 'DAILY':
      nextDate.setUTCDate(
        nextDate.getUTCDate() + 1,
      );
      break;

    case 'WEEKLY':
      nextDate.setUTCDate(
        nextDate.getUTCDate() + 7,
      );
      break;

    case 'MONTHLY': {
      const originalDay =
        nextDate.getUTCDate();

      nextDate.setUTCDate(1);

      nextDate.setUTCMonth(
        nextDate.getUTCMonth() + 1,
      );

      const lastDayOfMonth =
        new Date(
          Date.UTC(
            nextDate.getUTCFullYear(),
            nextDate.getUTCMonth() + 1,
            0,
          ),
        ).getUTCDate();

      nextDate.setUTCDate(
        Math.min(
          originalDay,
          lastDayOfMonth,
        ),
      );

      break;
    }

    case 'YEARLY': {
      const originalMonth =
        nextDate.getUTCMonth();

      const originalDay =
        nextDate.getUTCDate();

      nextDate.setUTCDate(1);

      nextDate.setUTCFullYear(
        nextDate.getUTCFullYear() + 1,
      );

      nextDate.setUTCMonth(
        originalMonth,
      );

      const lastDayOfMonth =
        new Date(
          Date.UTC(
            nextDate.getUTCFullYear(),
            originalMonth + 1,
            0,
          ),
        ).getUTCDate();

      nextDate.setUTCDate(
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
  validateRecurringTransactionType(
    input.type,
  );

  validateRecurringFrequency(
    input.frequency,
  );

  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    throw new AppError(
      'Recurring transaction amount must be greater than zero',
      400,
    );
  }

  const normalizedDescription =
    input.description.trim();

  if (!normalizedDescription) {
    throw new AppError(
      'Description is required',
      400,
    );
  }

  if (
    Number.isNaN(
      input.startDate.getTime(),
    )
  ) {
    throw new AppError(
      'Invalid start date',
      400,
    );
  }

  if (
    input.endDate &&
    Number.isNaN(
      input.endDate.getTime(),
    )
  ) {
    throw new AppError(
      'Invalid end date',
      400,
    );
  }

  if (
    input.endDate &&
    input.endDate < input.startDate
  ) {
    throw new AppError(
      'End date must be greater than or equal to start date',
      400,
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
        throw new AppError(
          'Account not found',
          404,
        );
      }

      if (
        account.type ===
        'CREDIT_CARD'
      ) {
        throw new AppError(
          'Recurring transactions cannot use credit card accounts',
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
            },
          });

        if (!category) {
          throw new AppError(
            'Category not found',
            404,
          );
        }

        if (
          category.type !==
          input.type
        ) {
          throw new AppError(
            'Category type must match recurring transaction type',
            400,
          );
        }
      }

      return tx.recurringTransaction.create({
        data: {
          workspaceId:
            input.workspaceId,
          accountId:
            input.accountId,
          categoryId:
            input.categoryId ??
            null,
          type:
            input.type,
          amount:
            new Prisma.Decimal(
              input.amount,
            ),
          description:
            normalizedDescription,
          frequency:
            input.frequency,
          startDate:
            input.startDate,
          endDate:
            input.endDate ??
            null,
          nextRunDate:
            input.startDate,
          status: 'ACTIVE',
        },
      });
    },
  );
}

export async function listRecurringTransactions(
  workspaceId: string,
) {
  return prisma.recurringTransaction.findMany({
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
  });
}

export async function updateRecurringTransaction(
  input: UpdateRecurringTransactionInput,
) {
  if (
    input.accountId === undefined &&
    input.categoryId === undefined &&
    input.type === undefined &&
    input.amount === undefined &&
    input.description === undefined &&
    input.frequency === undefined &&
    input.nextRunDate === undefined &&
    input.endDate === undefined
  ) {
    throw new AppError(
      'At least one recurring transaction field must be provided',
      400,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const recurringTransaction =
        await tx.recurringTransaction.findFirst({
          where: {
            id:
              input.recurringTransactionId,
            workspaceId:
              input.workspaceId,
          },
        });

      if (!recurringTransaction) {
        throw new AppError(
          'Recurring transaction not found',
          404,
        );
      }

      if (
        recurringTransaction.status ===
        'CANCELLED'
      ) {
        throw new AppError(
          'Cancelled recurring transactions cannot be edited',
          400,
        );
      }

      const nextType =
        input.type ??
        recurringTransaction.type;

      validateRecurringTransactionType(
        nextType,
      );

      const nextFrequency =
        input.frequency ??
        recurringTransaction.frequency;

      validateRecurringFrequency(
        nextFrequency,
      );

      let nextAmount =
        recurringTransaction.amount;

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
            'Recurring transaction amount must be greater than zero',
            400,
          );
        }

        nextAmount =
          new Prisma.Decimal(
            input.amount,
          );
      }

      let nextDescription =
        recurringTransaction.description;

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

      const nextRunDate =
        input.nextRunDate ??
        recurringTransaction.nextRunDate;

      if (
        Number.isNaN(
          nextRunDate.getTime(),
        )
      ) {
        throw new AppError(
          'Invalid next run date',
          400,
        );
      }

      const nextEndDate =
        input.endDate !== undefined
          ? input.endDate
          : recurringTransaction.endDate;

      if (
        nextEndDate &&
        Number.isNaN(
          nextEndDate.getTime(),
        )
      ) {
        throw new AppError(
          'Invalid end date',
          400,
        );
      }

      if (
        nextEndDate &&
        nextEndDate <
          recurringTransaction.startDate
      ) {
        throw new AppError(
          'End date must be greater than or equal to start date',
          400,
        );
      }

      if (
        nextEndDate &&
        nextEndDate < nextRunDate
      ) {
        throw new AppError(
          'End date must be greater than or equal to next run date',
          400,
        );
      }

      const nextAccountId =
        input.accountId ??
        recurringTransaction.accountId;

      const account =
        await tx.account.findFirst({
          where: {
            id: nextAccountId,
            workspaceId:
              input.workspaceId,
            status: 'ACTIVE',
          },
        });

      if (!account) {
        throw new AppError(
          'Account not found',
          404,
        );
      }

      if (
        account.type ===
        'CREDIT_CARD'
      ) {
        throw new AppError(
          'Recurring transactions cannot use credit card accounts',
          400,
        );
      }

      const nextCategoryId =
        input.categoryId !== undefined
          ? input.categoryId
          : recurringTransaction.categoryId;

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
              type:
                nextType,
            },
          });

        if (!category) {
          throw new AppError(
            'Category not found or category type does not match recurring transaction type',
            404,
          );
        }
      }

      const updated =
        await tx.recurringTransaction.updateMany({
          where: {
            id:
              recurringTransaction.id,
            workspaceId:
              input.workspaceId,
            status:
              recurringTransaction.status,
            nextRunDate:
              recurringTransaction.nextRunDate,
            updatedAt:
              recurringTransaction.updatedAt,
          },
          data: {
            accountId:
              nextAccountId,
            categoryId:
              nextCategoryId,
            type:
              nextType,
            amount:
              nextAmount,
            description:
              nextDescription,
            frequency:
              nextFrequency,
            nextRunDate,
            endDate:
              nextEndDate,
          },
        });

      if (updated.count === 0) {
        throw new AppError(
          'Recurring transaction changed during update',
          409,
        );
      }

      const result =
        await tx.recurringTransaction.findUnique({
          where: {
            id:
              recurringTransaction.id,
          },
          include: {
            account: true,
            category: true,
          },
        });

      if (!result) {
        throw new AppError(
          'Recurring transaction not found',
          404,
        );
      }

      return result;
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
        await tx.recurringTransaction.findFirst({
          where: {
            id:
              recurringTransactionId,
            workspaceId,
          },
        });

      if (!recurringTransaction) {
        throw new AppError(
          'Recurring transaction not found',
          404,
        );
      }

      if (
        recurringTransaction.status !==
        'ACTIVE'
      ) {
        throw new AppError(
          'Recurring transaction is not active',
          400,
        );
      }

      const now =
        new Date();

      if (
        recurringTransaction.nextRunDate >
        now
      ) {
        throw new AppError(
          'Recurring transaction is not due yet',
          400,
        );
      }

      if (
        recurringTransaction.endDate &&
        recurringTransaction.nextRunDate >
          recurringTransaction.endDate
      ) {
        throw new AppError(
          'Recurring transaction has ended',
          400,
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
        throw new AppError(
          'Account not found',
          404,
        );
      }

      if (
        account.type ===
        'CREDIT_CARD'
      ) {
        throw new AppError(
          'Recurring transactions cannot use credit card accounts',
          400,
        );
      }

      if (
        recurringTransaction.categoryId
      ) {
        const category =
          await tx.category.findFirst({
            where: {
              id:
                recurringTransaction.categoryId,
              workspaceId,
              type:
                recurringTransaction.type,
            },
          });

        if (!category) {
          throw new AppError(
            'Category not found',
            404,
          );
        }
      }

      const scheduledDate =
        recurringTransaction.nextRunDate;

      const nextRunDate =
        calculateNextRunDate(
          scheduledDate,
          recurringTransaction.frequency,
        );

      const nextStatus =
        recurringTransaction.endDate &&
        nextRunDate >
          recurringTransaction.endDate
          ? 'CANCELLED'
          : 'ACTIVE';

      const claimed =
        await tx.recurringTransaction.updateMany({
          where: {
            id:
              recurringTransaction.id,
            workspaceId,
            status: 'ACTIVE',
            nextRunDate:
              scheduledDate,
            updatedAt:
              recurringTransaction.updatedAt,
          },
          data: {
            nextRunDate,
            status:
              nextStatus,
          },
        });

      if (claimed.count === 0) {
        throw new AppError(
          'Recurring transaction changed during execution',
          409,
        );
      }

      const transaction =
        await tx.financialTransaction.create({
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
              scheduledDate,
          },
        });

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
          type:
            ledgerEntryType,
          amount:
            recurringTransaction.amount,
        },
      });

      const updatedRecurringTransaction =
        await tx.recurringTransaction.findUnique({
          where: {
            id:
              recurringTransaction.id,
          },
        });

      if (
        !updatedRecurringTransaction
      ) {
        throw new AppError(
          'Recurring transaction not found',
          404,
        );
      }

      return {
        transaction,
        recurringTransaction:
          updatedRecurringTransaction,
      };
    },
  );
}

export async function processDueRecurringTransactions(
  workspaceId: string,
  maxExecutions = 100,
) {
  if (
    !Number.isInteger(
      maxExecutions,
    ) ||
    maxExecutions < 1 ||
    maxExecutions > 500
  ) {
    throw new AppError(
      'Invalid recurring processing limit',
      400,
    );
  }

  const now =
    new Date();

  const dueRecurringTransactions =
    await prisma.recurringTransaction.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        nextRunDate: {
          lte: now,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        nextRunDate: 'asc',
      },
      take:
        maxExecutions,
    });

  const queue =
    dueRecurringTransactions.map(
      (item) =>
        item.id,
    );

  const processed: Array<{
    recurringTransactionId: string;
    transactionId: string;
    transactionDate: Date;
  }> = [];

  const failed: Array<{
    recurringTransactionId: string;
    message: string;
  }> = [];

  while (
    queue.length > 0 &&
    processed.length <
      maxExecutions
  ) {
    const recurringTransactionId =
      queue.shift();

    if (!recurringTransactionId) {
      break;
    }

    try {
      const result =
        await executeRecurringTransaction(
          workspaceId,
          recurringTransactionId,
        );

      processed.push({
        recurringTransactionId,
        transactionId:
          result.transaction.id,
        transactionDate:
          result.transaction
            .transactionDate,
      });

      if (
        result.recurringTransaction
          .status === 'ACTIVE' &&
        result.recurringTransaction
          .nextRunDate <= now
      ) {
        queue.push(
          recurringTransactionId,
        );
      }
    } catch (error) {
      if (
        error instanceof AppError &&
        (
          error.message ===
            'Recurring transaction is not due yet' ||
          error.message ===
            'Recurring transaction is not active' ||
          error.message ===
            'Recurring transaction changed during execution'
        )
      ) {
        continue;
      }

      if (
        error instanceof AppError &&
        error.message ===
          'Recurring transaction has ended'
      ) {
        try {
          await cancelRecurringTransaction(
            workspaceId,
            recurringTransactionId,
          );
        } catch {
          // Another operation may have
          // already changed the recurrence.
        }

        continue;
      }

      failed.push({
        recurringTransactionId,
        message:
          error instanceof Error
            ? error.message
            : 'Unknown recurring transaction error',
      });
    }
  }

  const remainingDue =
    await prisma.recurringTransaction.count({
      where: {
        workspaceId,
        status: 'ACTIVE',
        nextRunDate: {
          lte: new Date(),
        },
      },
    });

  return {
    processedCount:
      processed.length,
    failedCount:
      failed.length,
    hasMoreDue:
      remainingDue > 0,
    processed,
    failed,
  };
}

export async function processAllDueRecurringTransactions(
  maxExecutionsPerWorkspace = 100,
) {
  const now =
    new Date();

  const dueWorkspaces =
    await prisma.recurringTransaction.findMany({
      where: {
        status: 'ACTIVE',
        nextRunDate: {
          lte: now,
        },
      },
      select: {
        workspaceId: true,
      },
      distinct: [
        'workspaceId',
      ],
    });

  const results = [];

  for (
    const workspace
    of dueWorkspaces
  ) {
    const result =
      await processDueRecurringTransactions(
        workspace.workspaceId,
        maxExecutionsPerWorkspace,
      );

    results.push({
      workspaceId:
        workspace.workspaceId,
      ...result,
    });
  }

  return {
    workspaceCount:
      results.length,
    results,
  };
}

export async function pauseRecurringTransaction(
  workspaceId: string,
  recurringTransactionId: string,
) {
  const recurringTransaction =
    await prisma.recurringTransaction.findFirst({
      where: {
        id:
          recurringTransactionId,
        workspaceId,
      },
    });

  if (!recurringTransaction) {
    throw new AppError(
      'Recurring transaction not found',
      404,
    );
  }

  if (
    recurringTransaction.status ===
    'CANCELLED'
  ) {
    throw new AppError(
      'Cancelled recurring transaction cannot be paused',
      400,
    );
  }

  if (
    recurringTransaction.status ===
    'PAUSED'
  ) {
    throw new AppError(
      'Recurring transaction is already paused',
      400,
    );
  }

  const updated =
    await prisma.recurringTransaction.updateMany({
      where: {
        id:
          recurringTransaction.id,
        workspaceId,
        status: 'ACTIVE',
        updatedAt:
          recurringTransaction.updatedAt,
      },
      data: {
        status: 'PAUSED',
      },
    });

  if (updated.count === 0) {
    throw new AppError(
      'Recurring transaction changed during update',
      409,
    );
  }

  return prisma.recurringTransaction.findUnique({
    where: {
      id:
        recurringTransaction.id,
    },
  });
}

export async function resumeRecurringTransaction(
  workspaceId: string,
  recurringTransactionId: string,
) {
  const recurringTransaction =
    await prisma.recurringTransaction.findFirst({
      where: {
        id:
          recurringTransactionId,
        workspaceId,
      },
    });

  if (!recurringTransaction) {
    throw new AppError(
      'Recurring transaction not found',
      404,
    );
  }

  if (
    recurringTransaction.status ===
    'CANCELLED'
  ) {
    throw new AppError(
      'Cancelled recurring transaction cannot be resumed',
      400,
    );
  }

  if (
    recurringTransaction.status ===
    'ACTIVE'
  ) {
    throw new AppError(
      'Recurring transaction is already active',
      400,
    );
  }

  const updated =
    await prisma.recurringTransaction.updateMany({
      where: {
        id:
          recurringTransaction.id,
        workspaceId,
        status: 'PAUSED',
        updatedAt:
          recurringTransaction.updatedAt,
      },
      data: {
        status: 'ACTIVE',
      },
    });

  if (updated.count === 0) {
    throw new AppError(
      'Recurring transaction changed during update',
      409,
    );
  }

  return prisma.recurringTransaction.findUnique({
    where: {
      id:
        recurringTransaction.id,
    },
  });
}

export async function cancelRecurringTransaction(
  workspaceId: string,
  recurringTransactionId: string,
) {
  const recurringTransaction =
    await prisma.recurringTransaction.findFirst({
      where: {
        id:
          recurringTransactionId,
        workspaceId,
      },
    });

  if (!recurringTransaction) {
    throw new AppError(
      'Recurring transaction not found',
      404,
    );
  }

  if (
    recurringTransaction.status ===
    'CANCELLED'
  ) {
    throw new AppError(
      'Recurring transaction is already cancelled',
      400,
    );
  }

  const updated =
    await prisma.recurringTransaction.updateMany({
      where: {
        id:
          recurringTransaction.id,
        workspaceId,
        status:
          recurringTransaction.status,
        updatedAt:
          recurringTransaction.updatedAt,
      },
      data: {
        status: 'CANCELLED',
      },
    });

  if (updated.count === 0) {
    throw new AppError(
      'Recurring transaction changed during update',
      409,
    );
  }

  return prisma.recurringTransaction.findUnique({
    where: {
      id:
        recurringTransaction.id,
    },
  });
}