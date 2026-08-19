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
  const category = await prisma.category.findFirst({
    where: {
      id: input.categoryId,
      workspaceId: input.workspaceId,
    },
  });

  if (!category) {
    throw new Error('Category not found');
  }

  if (category.type !== 'EXPENSE') {
    throw new Error(
      'Budget category must be an expense category',
    );
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Budget amount must be greater than zero');
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
  return prisma.budget.findMany({
    where: {
      workspaceId,
      ...(month !== undefined ? { month } : {}),
      ...(year !== undefined ? { year } : {}),
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
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      workspaceId,
    },
    include: {
      category: true,
    },
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  const transactions =
    await prisma.financialTransaction.findMany({
      where: {
        workspaceId,
        categoryId: budget.categoryId,
        type: 'EXPENSE',
        status: 'POSTED',
        transactionDate: {
          gte: new Date(
            Date.UTC(
              budget.year,
              budget.month - 1,
              1,
            ),
          ),
          lt: new Date(
            Date.UTC(
              budget.year,
              budget.month,
              1,
            ),
          ),
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

  let spent = new Prisma.Decimal(0);

  for (const transaction of transactions) {
    for (const entry of transaction.entries) {
      if (entry.type === 'DEBIT') {
        spent = spent.plus(entry.amount);
      }
    }
  }

  const remaining = budget.amount.minus(spent);

  const percentage = budget.amount.isZero()
    ? new Prisma.Decimal(0)
    : spent
        .div(budget.amount)
        .mul(100);

  return {
    budget,
    spent,
    remaining,
    percentage,
  };
}