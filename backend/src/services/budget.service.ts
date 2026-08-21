import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface CreateBudgetInput {
  workspaceId: string;
  categoryId: string;
  amount: number;
  month: number;
  year: number;
}

export async function createBudget(
  input: CreateBudgetInput,
) {
  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    throw new Error(
      'Budget amount must be greater than zero',
    );
  }

  if (
    !Number.isInteger(input.month) ||
    input.month < 1 ||
    input.month > 12
  ) {
    throw new Error(
      'Month must be an integer between 1 and 12',
    );
  }

  if (
    !Number.isInteger(input.year) ||
    input.year < 2000
  ) {
    throw new Error(
      'Year must be a valid integer greater than or equal to 2000',
    );
  }

  const category =
    await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        workspaceId: input.workspaceId,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

  if (!category) {
    throw new Error(
      'Category not found',
    );
  }

  if (category.type !== 'EXPENSE') {
    throw new Error(
      'Budget category must be an expense category',
    );
  }

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
    throw new Error(
      'Budget already exists for this category and period',
    );
  }

  return prisma.budget.create({
    data: {
      workspaceId: input.workspaceId,
      categoryId: input.categoryId,
      amount: input.amount,
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
  if (
    month !== undefined &&
    (!Number.isInteger(month) ||
      month < 1 ||
      month > 12)
  ) {
    throw new Error(
      'Month must be an integer between 1 and 12',
    );
  }

  if (
    year !== undefined &&
    (!Number.isInteger(year) ||
      year < 2000)
  ) {
    throw new Error(
      'Year must be a valid integer greater than or equal to 2000',
    );
  }

  if (
    (month !== undefined && year === undefined) ||
    (month === undefined && year !== undefined)
  ) {
    throw new Error(
      'Month and year must be provided together',
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
    throw new Error(
      'Budget not found',
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
        categoryId: budget.categoryId,
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

  for (const transaction of transactions) {
    for (const entry of transaction.entries) {
      if (entry.type === 'DEBIT') {
        spent =
          spent.plus(entry.amount);
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

  if (percentage.greaterThanOrEqualTo(100)) {
    status = 'EXCEEDED';
  } else if (
    percentage.greaterThanOrEqualTo(80)
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