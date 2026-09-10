import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface CreateBudgetInput {
  workspaceId: string;
  categoryId: string;
  amount: number;
  month: number;
  year: number;
}

export interface UpdateBudgetInput {
  workspaceId: string;
  budgetId: string;
  categoryId?: string;
  amount?: number;
  month?: number;
  year?: number;
}

export interface DeleteBudgetInput {
  workspaceId: string;
  budgetId: string;
}

function validateAmount(
  amount: number,
) {
  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new AppError(
      'Budget amount must be greater than zero',
      400,
    );
  }
}

function validateMonth(
  month: number,
) {
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new AppError(
      'Month must be an integer between 1 and 12',
      400,
    );
  }
}

function validateYear(
  year: number,
) {
  if (
    !Number.isInteger(year) ||
    year < 2000
  ) {
    throw new AppError(
      'Year must be a valid integer greater than or equal to 2000',
      400,
    );
  }
}

async function validateExpenseCategory(
  workspaceId: string,
  categoryId: string,
) {
  const category =
    await prisma.category.findFirst({
      where: {
        id: categoryId,
        workspaceId,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

  if (!category) {
    throw new AppError(
      'Category not found',
      404,
    );
  }

  if (category.type !== 'EXPENSE') {
    throw new AppError(
      'Budget category must be an expense category',
      400,
    );
  }

  return category;
}

export async function createBudget(
  input: CreateBudgetInput,
) {
  validateAmount(input.amount);
  validateMonth(input.month);
  validateYear(input.year);

  await validateExpenseCategory(
    input.workspaceId,
    input.categoryId,
  );

  const existingBudget =
    await prisma.budget.findUnique({
      where: {
        workspaceId_categoryId_month_year: {
          workspaceId: input.workspaceId,
          categoryId: input.categoryId,
          month: input.month,
          year: input.year,
        },
      },
    });

  if (existingBudget) {
    throw new AppError(
      'Budget already exists for this category and period',
      409,
    );
  }

  return prisma.budget.create({
    data: {
      workspaceId: input.workspaceId,
      categoryId: input.categoryId,
      amount: new Prisma.Decimal(
        input.amount,
      ),
      month: input.month,
      year: input.year,
    },
    include: {
      category: true,
    },
  });
}

export async function listBudgets(
  workspaceId: string,
  month?: number,
  year?: number,
) {
  if (month !== undefined) {
    validateMonth(month);
  }

  if (year !== undefined) {
    validateYear(year);
  }

  if (
    (month !== undefined &&
      year === undefined) ||
    (month === undefined &&
      year !== undefined)
  ) {
    throw new AppError(
      'Month and year must be provided together',
      400,
    );
  }

  return prisma.budget.findMany({
    where: {
      workspaceId,
      ...(month !== undefined
        ? { month }
        : {}),
      ...(year !== undefined
        ? { year }
        : {}),
    },
    include: {
      category: true,
    },
    orderBy: [
      {
        year: 'desc',
      },
      {
        month: 'desc',
      },
      {
        category: {
          name: 'asc',
        },
      },
    ],
  });
}

export async function updateBudget(
  input: UpdateBudgetInput,
) {
  if (
    input.categoryId === undefined &&
    input.amount === undefined &&
    input.month === undefined &&
    input.year === undefined
  ) {
    throw new AppError(
      'At least one budget field must be provided',
      400,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const budget =
        await tx.budget.findFirst({
          where: {
            id: input.budgetId,
            workspaceId:
              input.workspaceId,
          },
        });

      if (!budget) {
        throw new AppError(
          'Budget not found',
          404,
        );
      }

      const nextCategoryId =
        input.categoryId ??
        budget.categoryId;

      const nextMonth =
        input.month ??
        budget.month;

      const nextYear =
        input.year ??
        budget.year;

      const nextAmount =
        input.amount !== undefined
          ? new Prisma.Decimal(
              input.amount,
            )
          : budget.amount;

      if (input.amount !== undefined) {
        validateAmount(
          input.amount,
        );
      }

      validateMonth(nextMonth);
      validateYear(nextYear);

      if (
        input.categoryId !== undefined
      ) {
        const category =
          await tx.category.findFirst({
            where: {
              id: nextCategoryId,
              workspaceId:
                input.workspaceId,
            },
            select: {
              type: true,
            },
          });

        if (!category) {
          throw new AppError(
            'Category not found',
            404,
          );
        }

        if (
          category.type !== 'EXPENSE'
        ) {
          throw new AppError(
            'Budget category must be an expense category',
            400,
          );
        }
      }

      const duplicateBudget =
        await tx.budget.findFirst({
          where: {
            workspaceId:
              input.workspaceId,
            categoryId:
              nextCategoryId,
            month: nextMonth,
            year: nextYear,
            id: {
              not: budget.id,
            },
          },
        });

      if (duplicateBudget) {
        throw new AppError(
          'Budget already exists for this category and period',
          409,
        );
      }

      return tx.budget.update({
        where: {
          id: budget.id,
        },
        data: {
          categoryId:
            nextCategoryId,
          amount: nextAmount,
          month: nextMonth,
          year: nextYear,
        },
        include: {
          category: true,
        },
      });
    },
  );
}

export async function deleteBudget(
  input: DeleteBudgetInput,
) {
  const budget =
    await prisma.budget.findFirst({
      where: {
        id: input.budgetId,
        workspaceId:
          input.workspaceId,
      },
      include: {
        category: true,
      },
    });

  if (!budget) {
    throw new AppError(
      'Budget not found',
      404,
    );
  }

  await prisma.budget.delete({
    where: {
      id: budget.id,
    },
  });

  return budget;
}

export async function getBudgetProgress(
  workspaceId: string,
  budgetId: string,
) {
  const budget =
    await prisma.budget.findFirst({
      where: {
        id: budgetId,
        workspaceId,
      },
      include: {
        category: true,
      },
    });

  if (!budget) {
    throw new AppError(
      'Budget not found',
      404,
    );
  }

  const periodStart = new Date(
    Date.UTC(
      budget.year,
      budget.month - 1,
      1,
    ),
  );

  const periodEnd = new Date(
    Date.UTC(
      budget.year,
      budget.month,
      1,
    ),
  );

  const transactions =
    await prisma.financialTransaction.findMany({
      where: {
        workspaceId,
        categoryId:
          budget.categoryId,
        type: 'EXPENSE',
        status: 'POSTED',
        transactionDate: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      include: {
        entries: {
          select: {
            type: true,
            amount: true,
          },
        },
      },
    });

  let spent =
    new Prisma.Decimal(0);

  for (
    const transaction
    of transactions
  ) {
    for (
      const entry
      of transaction.entries
    ) {
      if (
        entry.type === 'DEBIT'
      ) {
        spent =
          spent.plus(
            entry.amount,
          );
      }
    }
  }

  const remaining =
    budget.amount.minus(spent);

  const percentage =
    budget.amount.isZero()
      ? new Prisma.Decimal(0)
      : spent
          .div(budget.amount)
          .mul(100);

  let status:
    | 'ON_TRACK'
    | 'WARNING'
    | 'EXCEEDED';

  if (
    percentage.greaterThanOrEqualTo(
      100,
    )
  ) {
    status = 'EXCEEDED';
  } else if (
    percentage.greaterThanOrEqualTo(
      80,
    )
  ) {
    status = 'WARNING';
  } else {
    status = 'ON_TRACK';
  }

  return {
    budget,
    spent,
    remaining,
    percentage,
    status,
  };
}