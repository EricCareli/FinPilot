import { randomUUID } from 'node:crypto';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'vitest';

import {
  prisma,
} from '../lib/prisma.js';

import {
  createAccount,
} from '../services/account.service.js';

import {
  createBudget,
  deleteBudget,
  getBudgetProgress,
  listBudgets,
  updateBudget,
} from '../services/budget.service.js';

import {
  createCategory,
} from '../services/category.service.js';

import {
  createTransaction,
  voidTransaction,
} from '../services/transaction.service.js';

const TEST_PREFIX =
  'FINPILOT_BUDGET_TEST_';

async function createTestWorkspace() {
  return prisma.workspace.create({
    data: {
      name:
        `${TEST_PREFIX}${randomUUID()}`,
      type: 'BUSINESS',
    },
  });
}

async function cleanupTestData() {
  const workspaces =
    await prisma.workspace.findMany({
      where: {
        name: {
          startsWith:
            TEST_PREFIX,
        },
      },
      select: {
        id: true,
      },
    });

  if (
    workspaces.length === 0
  ) {
    return;
  }

  const workspaceIds =
    workspaces.map(
      (workspace) =>
        workspace.id,
    );

  await prisma.financialTransaction.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.recurringTransaction.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.budget.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.category.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.account.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.workspace.deleteMany({
    where: {
      id: {
        in: workspaceIds,
      },
    },
  });
}

beforeAll(
  async () => {
    await cleanupTestData();
  },
);

afterEach(
  async () => {
    await cleanupTestData();
  },
);

afterAll(
  async () => {
    await cleanupTestData();

    await prisma.$disconnect();
  },
);

describe(
  'Budgets',
  () => {
    test(
      'creates a budget for an expense category',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Alimentação',
            type:
              'EXPENSE',
          });

        const budget =
          await createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              1000,
            month:
              9,
            year:
              2026,
          });

        expect(
          budget.workspaceId,
        ).toBe(workspace.id);

        expect(
          budget.categoryId,
        ).toBe(category.id);

        expect(
          budget.amount.toString(),
        ).toBe('1000');

        expect(
          budget.month,
        ).toBe(9);

        expect(
          budget.year,
        ).toBe(2026);

        expect(
          budget.category.id,
        ).toBe(category.id);

        expect(
          budget.category.type,
        ).toBe('EXPENSE');
      },
    );

    test(
      'rejects an income category when creating a budget',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Salário',
            type:
              'INCOME',
          });

        await expect(
          createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              1000,
            month:
              9,
            year:
              2026,
          }),
        ).rejects.toThrow(
          'Budget category must be an expense category',
        );

        const budgets =
          await prisma.budget.count({
            where: {
              workspaceId:
                workspace.id,
            },
          });

        expect(
          budgets,
        ).toBe(0);
      },
    );

    test(
      'rejects duplicate budget for the same category and period',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Transporte',
            type:
              'EXPENSE',
          });

        await createBudget({
          workspaceId:
            workspace.id,
          categoryId:
            category.id,
          amount:
            500,
          month:
            9,
          year:
            2026,
        });

        await expect(
          createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              900,
            month:
              9,
            year:
              2026,
          }),
        ).rejects.toThrow(
          'Budget already exists for this category and period',
        );

        const budgets =
          await prisma.budget.findMany({
            where: {
              workspaceId:
                workspace.id,
            },
          });

        expect(
          budgets,
        ).toHaveLength(1);

        expect(
          budgets[0]?.amount.toString(),
        ).toBe('500');
      },
    );

    test(
      'validates amount month and year',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Lazer',
            type:
              'EXPENSE',
          });

        await expect(
          createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              0,
            month:
              9,
            year:
              2026,
          }),
        ).rejects.toThrow(
          'Budget amount must be greater than zero',
        );

        await expect(
          createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              100,
            month:
              13,
            year:
              2026,
          }),
        ).rejects.toThrow(
          'Month must be an integer between 1 and 12',
        );

        await expect(
          createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              100,
            month:
              9,
            year:
              1999,
          }),
        ).rejects.toThrow(
          'Year must be a valid integer greater than or equal to 2000',
        );

        const budgets =
          await prisma.budget.count({
            where: {
              workspaceId:
                workspace.id,
            },
          });

        expect(
          budgets,
        ).toBe(0);
      },
    );

    test(
      'lists budgets and filters by month and year',
      async () => {
        const workspace =
          await createTestWorkspace();

        const food =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Alimentação',
            type:
              'EXPENSE',
          });

        const transport =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Transporte',
            type:
              'EXPENSE',
          });

        await createBudget({
          workspaceId:
            workspace.id,
          categoryId:
            food.id,
          amount:
            1000,
          month:
            9,
          year:
            2026,
        });

        await createBudget({
          workspaceId:
            workspace.id,
          categoryId:
            transport.id,
          amount:
            500,
          month:
            9,
          year:
            2026,
        });

        await createBudget({
          workspaceId:
            workspace.id,
          categoryId:
            food.id,
          amount:
            1200,
          month:
            10,
          year:
            2026,
        });

        const allBudgets =
          await listBudgets(
            workspace.id,
          );

        expect(
          allBudgets,
        ).toHaveLength(3);

        const septemberBudgets =
          await listBudgets(
            workspace.id,
            9,
            2026,
          );

        expect(
          septemberBudgets,
        ).toHaveLength(2);

        expect(
          septemberBudgets.every(
            (budget) =>
              budget.month === 9 &&
              budget.year === 2026,
          ),
        ).toBe(true);

        await expect(
          listBudgets(
            workspace.id,
            9,
          ),
        ).rejects.toThrow(
          'Month and year must be provided together',
        );
      },
    );

    test(
      'updates budget amount category and period',
      async () => {
        const workspace =
          await createTestWorkspace();

        const food =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Alimentação',
            type:
              'EXPENSE',
          });

        const leisure =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Lazer',
            type:
              'EXPENSE',
          });

        const budget =
          await createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              food.id,
            amount:
              1000,
            month:
              9,
            year:
              2026,
          });

        const updated =
          await updateBudget({
            workspaceId:
              workspace.id,
            budgetId:
              budget.id,
            categoryId:
              leisure.id,
            amount:
              1500,
            month:
              10,
            year:
              2026,
          });

        expect(
          updated.id,
        ).toBe(budget.id);

        expect(
          updated.categoryId,
        ).toBe(leisure.id);

        expect(
          updated.category.id,
        ).toBe(leisure.id);

        expect(
          updated.amount.toString(),
        ).toBe('1500');

        expect(
          updated.month,
        ).toBe(10);

        expect(
          updated.year,
        ).toBe(2026);

        const persisted =
          await prisma.budget.findUniqueOrThrow({
            where: {
              id:
                budget.id,
            },
          });

        expect(
          persisted.categoryId,
        ).toBe(leisure.id);

        expect(
          persisted.amount.toString(),
        ).toBe('1500');
      },
    );

    test(
      'rejects an update that would create a duplicate budget',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Moradia',
            type:
              'EXPENSE',
          });

        const september =
          await createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              2000,
            month:
              9,
            year:
              2026,
          });

        const october =
          await createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              2200,
            month:
              10,
            year:
              2026,
          });

        await expect(
          updateBudget({
            workspaceId:
              workspace.id,
            budgetId:
              october.id,
            month:
              9,
          }),
        ).rejects.toThrow(
          'Budget already exists for this category and period',
        );

        const persistedSeptember =
          await prisma.budget.findUniqueOrThrow({
            where: {
              id:
                september.id,
            },
          });

        const persistedOctober =
          await prisma.budget.findUniqueOrThrow({
            where: {
              id:
                october.id,
            },
          });

        expect(
          persistedSeptember.month,
        ).toBe(9);

        expect(
          persistedOctober.month,
        ).toBe(10);
      },
    );

    test(
      'deletes a budget',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Viagens',
            type:
              'EXPENSE',
          });

        const budget =
          await createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              3000,
            month:
              12,
            year:
              2026,
          });

        const deleted =
          await deleteBudget({
            workspaceId:
              workspace.id,
            budgetId:
              budget.id,
          });

        expect(
          deleted.id,
        ).toBe(budget.id);

        expect(
          deleted.category.id,
        ).toBe(category.id);

        const persisted =
          await prisma.budget.findUnique({
            where: {
              id:
                budget.id,
            },
          });

        expect(
          persisted,
        ).toBeNull();
      },
    );

    test(
      'calculates budget progress using only posted expenses in the selected period',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Mercado',
            type:
              'EXPENSE',
          });

        const otherCategory =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Outros gastos',
            type:
              'EXPENSE',
          });

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta orçamento',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              2000,
          });

        const budget =
          await createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              1000,
            month:
              9,
            year:
              2026,
          });

        await createTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            category.id,
          type:
            'EXPENSE',
          amount:
            300,
          description:
            'Compra setembro',
          transactionDate:
            new Date(
              '2026-09-10T12:00:00.000Z',
            ),
        });

        await createTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            category.id,
          type:
            'EXPENSE',
          amount:
            200,
          description:
            'Compra agosto',
          transactionDate:
            new Date(
              '2026-08-31T12:00:00.000Z',
            ),
        });

        await createTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            otherCategory.id,
          type:
            'EXPENSE',
          amount:
            150,
          description:
            'Outra categoria',
          transactionDate:
            new Date(
              '2026-09-12T12:00:00.000Z',
            ),
        });

        const voidedTransaction =
          await createTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            categoryId:
              category.id,
            type:
              'EXPENSE',
            amount:
              400,
            description:
              'Despesa anulada',
            transactionDate:
              new Date(
                '2026-09-15T12:00:00.000Z',
              ),
          });

        await voidTransaction({
          workspaceId:
            workspace.id,
          transactionId:
            voidedTransaction.id,
        });

        const progress =
          await getBudgetProgress(
            workspace.id,
            budget.id,
          );

        expect(
          progress.spent.toString(),
        ).toBe('300');

        expect(
          progress.remaining.toString(),
        ).toBe('700');

        expect(
          progress.percentage.toString(),
        ).toBe('30');

        expect(
          progress.status,
        ).toBe('ON_TRACK');
      },
    );

    test(
      'changes budget progress status to warning and exceeded at the correct thresholds',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Compras',
            type:
              'EXPENSE',
          });

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta progresso',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              3000,
          });

        const budget =
          await createBudget({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            amount:
              1000,
            month:
              9,
            year:
              2026,
          });

        await createTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            category.id,
          type:
            'EXPENSE',
          amount:
            800,
          description:
            'Gasto oitenta por cento',
          transactionDate:
            new Date(
              '2026-09-10T12:00:00.000Z',
            ),
        });

        const warningProgress =
          await getBudgetProgress(
            workspace.id,
            budget.id,
          );

        expect(
          warningProgress.spent.toString(),
        ).toBe('800');

        expect(
          warningProgress.percentage.toString(),
        ).toBe('80');

        expect(
          warningProgress.remaining.toString(),
        ).toBe('200');

        expect(
          warningProgress.status,
        ).toBe('WARNING');

        await createTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            category.id,
          type:
            'EXPENSE',
          amount:
            250,
          description:
            'Gasto acima do orçamento',
          transactionDate:
            new Date(
              '2026-09-20T12:00:00.000Z',
            ),
        });

        const exceededProgress =
          await getBudgetProgress(
            workspace.id,
            budget.id,
          );

        expect(
          exceededProgress.spent.toString(),
        ).toBe('1050');

        expect(
          exceededProgress.percentage.toString(),
        ).toBe('105');

        expect(
          exceededProgress.remaining.toString(),
        ).toBe('-50');

        expect(
          exceededProgress.status,
        ).toBe('EXCEEDED');
      },
    );
  },
);