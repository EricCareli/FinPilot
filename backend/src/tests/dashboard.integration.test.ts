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
  Prisma,
} from '../generated/prisma/client.js';

import {
  prisma,
} from '../lib/prisma.js';

import {
  createAccount,
} from '../services/account.service.js';

import {
  createCategory,
} from '../services/category.service.js';

import {
  getDashboard,
} from '../services/dashboard.service.js';

const TEST_PREFIX =
  'FINPILOT_DASHBOARD_TEST_';

type FinancialType =
  | 'INCOME'
  | 'EXPENSE';

type TransactionStatus =
  | 'POSTED'
  | 'VOIDED';

async function createTestWorkspace() {
  return prisma.workspace.create({
    data: {
      name:
        `${TEST_PREFIX}${randomUUID()}`,
      type: 'BUSINESS',
    },
  });
}

async function createTestAccount(
  workspaceId: string,
  name: string,
  initialBalance = 0,
) {
  return createAccount({
    workspaceId,
    name,
    type: 'CHECKING',
    currency: 'BRL',
    initialBalance,
  });
}

async function createTestCategory(
  workspaceId: string,
  name: string,
  type: FinancialType,
) {
  return createCategory({
    workspaceId,
    name,
    type,
  });
}

async function createLedgerTransaction(
  input: {
    workspaceId: string;
    accountId: string;
    categoryId?: string;
    type: FinancialType;
    amount: number;
    description: string;
    transactionDate: Date;
    status?: TransactionStatus;
  },
) {
  return prisma.$transaction(
    async (tx) => {
      const transaction =
        await tx.financialTransaction.create({
          data: {
            workspaceId:
              input.workspaceId,
            categoryId:
              input.categoryId ??
              null,
            type:
              input.type,
            status:
              input.status ??
              'POSTED',
            description:
              input.description,
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
          type:
            input.type ===
            'INCOME'
              ? 'CREDIT'
              : 'DEBIT',
          amount:
            new Prisma.Decimal(
              input.amount,
            ),
        },
      });

      return transaction;
    },
  );
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

  await prisma.budget.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.financialTransaction.deleteMany({
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
  'Dashboard',
  () => {
    test(
      'returns an empty dashboard for a workspace without financial data',
      async () => {
        const workspace =
          await createTestWorkspace();

        const dashboard =
          await getDashboard(
            workspace.id,
          );

        expect(
          dashboard.period,
        ).toBeNull();

        expect(
          dashboard.totalBalance.toString(),
        ).toBe('0');

        expect(
          dashboard.totalIncome.toString(),
        ).toBe('0');

        expect(
          dashboard.totalExpense.toString(),
        ).toBe('0');

        expect(
          dashboard.netResult.toString(),
        ).toBe('0');

        expect(
          dashboard.savingsRate,
        ).toBeNull();

        expect(
          dashboard.previousMonth,
        ).toBeNull();

        expect(
          dashboard.comparison,
        ).toBeNull();

        expect(
          dashboard.expenseByCategory,
        ).toEqual([]);

        expect(
          dashboard.monthlyEvolution,
        ).toHaveLength(6);

        expect(
          dashboard.budgets,
        ).toEqual([]);

        expect(
          dashboard.accountCount,
        ).toBe(0);

        expect(
          dashboard.accounts,
        ).toEqual([]);

        expect(
          dashboard.creditCards.count,
        ).toBe(0);

        expect(
          dashboard.creditCards
            .totalCreditLimit
            .toString(),
        ).toBe('0');

        expect(
          dashboard.creditCards
            .totalCreditUsed
            .toString(),
        ).toBe('0');

        expect(
          dashboard.creditCards
            .totalCreditAvailable
            .toString(),
        ).toBe('0');

        expect(
          dashboard.creditCards.cards,
        ).toEqual([]);

        expect(
          dashboard.recentTransactions,
        ).toEqual([]);
      },
    );

    test(
      'validates month year and requires both period fields together',
      async () => {
        const workspace =
          await createTestWorkspace();

        await expect(
          getDashboard(
            workspace.id,
            {
              month: 0,
              year: 2026,
            },
          ),
        ).rejects.toThrow(
          'Month must be between 1 and 12',
        );

        await expect(
          getDashboard(
            workspace.id,
            {
              month: 13,
              year: 2026,
            },
          ),
        ).rejects.toThrow(
          'Month must be between 1 and 12',
        );

        await expect(
          getDashboard(
            workspace.id,
            {
              month: 9,
              year: 1999,
            },
          ),
        ).rejects.toThrow(
          'Invalid year',
        );

        await expect(
          getDashboard(
            workspace.id,
            {
              month: 9,
            },
          ),
        ).rejects.toThrow(
          'Month and year must be provided together',
        );

        await expect(
          getDashboard(
            workspace.id,
            {
              year: 2026,
            },
          ),
        ).rejects.toThrow(
          'Month and year must be provided together',
        );
      },
    );

    test(
      'calculates active account balances using the posted ledger',
      async () => {
        const workspace =
          await createTestWorkspace();

        const accountA =
          await createTestAccount(
            workspace.id,
            'Conta principal',
            1000,
          );

        const accountB =
          await createTestAccount(
            workspace.id,
            'Conta reserva',
            500,
          );

        const archivedAccount =
          await createTestAccount(
            workspace.id,
            'Conta arquivada',
            0,
          );

        await prisma.account.update({
          where: {
            id:
              archivedAccount.id,
          },
          data: {
            status:
              'ARCHIVED',
          },
        });

        const dashboard =
          await getDashboard(
            workspace.id,
          );

        expect(
          dashboard.accountCount,
        ).toBe(2);

        expect(
          dashboard.totalBalance.toString(),
        ).toBe('1500');

        const principal =
          dashboard.accounts.find(
            (account) =>
              account.id ===
              accountA.id,
          );

        const reserva =
          dashboard.accounts.find(
            (account) =>
              account.id ===
              accountB.id,
          );

        expect(
          principal?.balance.toString(),
        ).toBe('1000');

        expect(
          reserva?.balance.toString(),
        ).toBe('500');

        expect(
          dashboard.accounts.some(
            (account) =>
              account.id ===
              archivedAccount.id,
          ),
        ).toBe(false);
      },
    );

    test(
      'calculates income expense net result savings rate and expense categories',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createTestAccount(
            workspace.id,
            'Conta dashboard',
          );

        const incomeCategory =
          await createTestCategory(
            workspace.id,
            'Salário',
            'INCOME',
          );

        const expenseCategory =
          await createTestCategory(
            workspace.id,
            'Alimentação',
            'EXPENSE',
          );

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            incomeCategory.id,
          type:
            'INCOME',
          amount:
            5000,
          description:
            'Salário',
          transactionDate:
            new Date(
              '2026-09-05T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            expenseCategory.id,
          type:
            'EXPENSE',
          amount:
            1000,
          description:
            'Mercado',
          transactionDate:
            new Date(
              '2026-09-10T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'EXPENSE',
          amount:
            500,
          description:
            'Despesa sem categoria',
          transactionDate:
            new Date(
              '2026-09-15T12:00:00.000Z',
            ),
        });

        const dashboard =
          await getDashboard(
            workspace.id,
            {
              month: 9,
              year: 2026,
            },
          );

        expect(
          dashboard.period,
        ).toEqual({
          month: 9,
          year: 2026,
        });

        expect(
          dashboard.totalIncome.toString(),
        ).toBe('5000');

        expect(
          dashboard.totalExpense.toString(),
        ).toBe('1500');

        expect(
          dashboard.netResult.toString(),
        ).toBe('3500');

        expect(
          dashboard.savingsRate?.toString(),
        ).toBe('70');

        expect(
          dashboard.expenseByCategory,
        ).toHaveLength(2);

        expect(
          dashboard.expenseByCategory[0]
            ?.categoryName,
        ).toBe(
          'Alimentação',
        );

        expect(
          dashboard.expenseByCategory[0]
            ?.amount
            .toString(),
        ).toBe('1000');

        expect(
          dashboard.expenseByCategory[1]
            ?.categoryName,
        ).toBe(
          'Sem categoria',
        );

        expect(
          dashboard.expenseByCategory[1]
            ?.amount
            .toString(),
        ).toBe('500');
      },
    );

    test(
      'filters period totals while keeping account balance based on all posted ledger entries',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createTestAccount(
            workspace.id,
            'Conta período',
          );

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'INCOME',
          amount:
            100,
          description:
            'Receita setembro',
          transactionDate:
            new Date(
              '2026-09-10T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'INCOME',
          amount:
            200,
          description:
            'Receita agosto',
          transactionDate:
            new Date(
              '2026-08-10T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'INCOME',
          amount:
            300,
          description:
            'Receita anulada',
          transactionDate:
            new Date(
              '2026-09-20T12:00:00.000Z',
            ),
          status:
            'VOIDED',
        });

        const dashboard =
          await getDashboard(
            workspace.id,
            {
              month: 9,
              year: 2026,
            },
          );

        expect(
          dashboard.totalIncome.toString(),
        ).toBe('100');

        expect(
          dashboard.totalExpense.toString(),
        ).toBe('0');

        expect(
          dashboard.totalBalance.toString(),
        ).toBe('300');

        expect(
          dashboard.recentTransactions,
        ).toHaveLength(1);

        expect(
          dashboard.recentTransactions[0]
            ?.description,
        ).toBe(
          'Receita setembro',
        );
      },
    );

    test(
      'builds a six month financial evolution ending at the selected month',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createTestAccount(
            workspace.id,
            'Conta evolução',
          );

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'INCOME',
          amount:
            400,
          description:
            'Receita abril',
          transactionDate:
            new Date(
              '2026-04-10T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'EXPENSE',
          amount:
            50,
          description:
            'Despesa maio',
          transactionDate:
            new Date(
              '2026-05-10T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'INCOME',
          amount:
            900,
          description:
            'Receita setembro',
          transactionDate:
            new Date(
              '2026-09-05T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'EXPENSE',
          amount:
            300,
          description:
            'Despesa setembro',
          transactionDate:
            new Date(
              '2026-09-06T12:00:00.000Z',
            ),
        });

        const dashboard =
          await getDashboard(
            workspace.id,
            {
              month: 9,
              year: 2026,
            },
          );

        expect(
          dashboard.monthlyEvolution.map(
            (item) =>
              `${item.year}-${item.month}`,
          ),
        ).toEqual([
          '2026-4',
          '2026-5',
          '2026-6',
          '2026-7',
          '2026-8',
          '2026-9',
        ]);

        const april =
          dashboard.monthlyEvolution.find(
            (item) =>
              item.month === 4 &&
              item.year === 2026,
          );

        expect(
          april?.income.toString(),
        ).toBe('400');

        expect(
          april?.expense.toString(),
        ).toBe('0');

        expect(
          april?.netResult.toString(),
        ).toBe('400');

        const may =
          dashboard.monthlyEvolution.find(
            (item) =>
              item.month === 5 &&
              item.year === 2026,
          );

        expect(
          may?.income.toString(),
        ).toBe('0');

        expect(
          may?.expense.toString(),
        ).toBe('50');

        expect(
          may?.netResult.toString(),
        ).toBe('-50');

        const september =
          dashboard.monthlyEvolution.find(
            (item) =>
              item.month === 9 &&
              item.year === 2026,
          );

        expect(
          september?.income.toString(),
        ).toBe('900');

        expect(
          september?.expense.toString(),
        ).toBe('300');

        expect(
          september?.netResult.toString(),
        ).toBe('600');
      },
    );

    test(
      'compares the selected month with the previous month',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createTestAccount(
            workspace.id,
            'Conta comparação',
          );

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'INCOME',
          amount:
            1000,
          description:
            'Receita agosto',
          transactionDate:
            new Date(
              '2026-08-05T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'EXPENSE',
          amount:
            250,
          description:
            'Despesa agosto',
          transactionDate:
            new Date(
              '2026-08-06T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'INCOME',
          amount:
            2000,
          description:
            'Receita setembro',
          transactionDate:
            new Date(
              '2026-09-05T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'EXPENSE',
          amount:
            500,
          description:
            'Despesa setembro',
          transactionDate:
            new Date(
              '2026-09-06T12:00:00.000Z',
            ),
        });

        const dashboard =
          await getDashboard(
            workspace.id,
            {
              month: 9,
              year: 2026,
            },
          );

        expect(
          dashboard.previousMonth?.month,
        ).toBe(8);

        expect(
          dashboard.previousMonth?.year,
        ).toBe(2026);

        expect(
          dashboard.previousMonth
            ?.income
            .toString(),
        ).toBe('1000');

        expect(
          dashboard.previousMonth
            ?.expense
            .toString(),
        ).toBe('250');

        expect(
          dashboard.previousMonth
            ?.netResult
            .toString(),
        ).toBe('750');

        expect(
          dashboard.comparison
            ?.incomeChange
            ?.toString(),
        ).toBe('100');

        expect(
          dashboard.comparison
            ?.expenseChange
            ?.toString(),
        ).toBe('100');

        expect(
          dashboard.comparison
            ?.netResultChange
            ?.toString(),
        ).toBe('100');
      },
    );

    test(
      'calculates dashboard budget usage and status thresholds',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createTestAccount(
            workspace.id,
            'Conta orçamento',
          );

        const onTrackCategory =
          await createTestCategory(
            workspace.id,
            'A On Track',
            'EXPENSE',
          );

        const warningCategory =
          await createTestCategory(
            workspace.id,
            'B Warning',
            'EXPENSE',
          );

        const exceededCategory =
          await createTestCategory(
            workspace.id,
            'C Exceeded',
            'EXPENSE',
          );

        for (
          const category of [
            onTrackCategory,
            warningCategory,
            exceededCategory,
          ]
        ) {
          await prisma.budget.create({
            data: {
              workspaceId:
                workspace.id,
              categoryId:
                category.id,
              amount:
                new Prisma.Decimal(
                  1000,
                ),
              month: 9,
              year: 2026,
            },
          });
        }

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            onTrackCategory.id,
          type:
            'EXPENSE',
          amount:
            500,
          description:
            'On track',
          transactionDate:
            new Date(
              '2026-09-10T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            warningCategory.id,
          type:
            'EXPENSE',
          amount:
            800,
          description:
            'Warning',
          transactionDate:
            new Date(
              '2026-09-11T12:00:00.000Z',
            ),
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            exceededCategory.id,
          type:
            'EXPENSE',
          amount:
            1000,
          description:
            'Exceeded',
          transactionDate:
            new Date(
              '2026-09-12T12:00:00.000Z',
            ),
        });

        const dashboard =
          await getDashboard(
            workspace.id,
            {
              month: 9,
              year: 2026,
            },
          );

        expect(
          dashboard.budgets,
        ).toHaveLength(3);

        const onTrack =
          dashboard.budgets.find(
            (budget) =>
              budget.categoryId ===
              onTrackCategory.id,
          );

        const warning =
          dashboard.budgets.find(
            (budget) =>
              budget.categoryId ===
              warningCategory.id,
          );

        const exceeded =
          dashboard.budgets.find(
            (budget) =>
              budget.categoryId ===
              exceededCategory.id,
          );

        expect(
          onTrack?.spent.toString(),
        ).toBe('500');

        expect(
          onTrack
            ?.percentageUsed
            .toString(),
        ).toBe('50');

        expect(
          onTrack?.status,
        ).toBe('ON_TRACK');

        expect(
          warning?.spent.toString(),
        ).toBe('800');

        expect(
          warning
            ?.percentageUsed
            .toString(),
        ).toBe('80');

        expect(
          warning?.status,
        ).toBe('WARNING');

        expect(
          exceeded?.spent.toString(),
        ).toBe('1000');

        expect(
          exceeded
            ?.percentageUsed
            .toString(),
        ).toBe('100');

        expect(
          exceeded?.status,
        ).toBe('EXCEEDED');

        expect(
          exceeded?.remaining.toString(),
        ).toBe('0');
      },
    );

    test(
      'returns only the ten newest recent transactions and isolates workspaces',
      async () => {
        const workspace =
          await createTestWorkspace();

        const otherWorkspace =
          await createTestWorkspace();

        const account =
          await createTestAccount(
            workspace.id,
            'Conta recentes',
          );

        const otherAccount =
          await createTestAccount(
            otherWorkspace.id,
            'Conta outro workspace',
          );

        for (
          let day = 1;
          day <= 12;
          day++
        ) {
          await createLedgerTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'INCOME',
            amount:
              10,
            description:
              `Tx ${day}`,
            transactionDate:
              new Date(
                Date.UTC(
                  2026,
                  8,
                  day,
                  12,
                ),
              ),
          });
        }

        await createLedgerTransaction({
          workspaceId:
            otherWorkspace.id,
          accountId:
            otherAccount.id,
          type:
            'INCOME',
          amount:
            999,
          description:
            'Outro workspace',
          transactionDate:
            new Date(
              '2026-09-30T12:00:00.000Z',
            ),
        });

        const dashboard =
          await getDashboard(
            workspace.id,
            {
              month: 9,
              year: 2026,
            },
          );

        expect(
          dashboard.totalIncome.toString(),
        ).toBe('120');

        expect(
          dashboard.recentTransactions,
        ).toHaveLength(10);

        expect(
          dashboard.recentTransactions[0]
            ?.description,
        ).toBe('Tx 12');

        expect(
          dashboard.recentTransactions[9]
            ?.description,
        ).toBe('Tx 3');

        expect(
          dashboard.recentTransactions.some(
            (transaction) =>
              transaction.description ===
              'Outro workspace',
          ),
        ).toBe(false);
      },
    );

    test(
      'keeps savings rate null when the selected period has no income',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createTestAccount(
            workspace.id,
            'Conta sem receita',
          );

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'EXPENSE',
          amount:
            250,
          description:
            'Despesa única',
          transactionDate:
            new Date(
              '2026-09-10T12:00:00.000Z',
            ),
        });

        const dashboard =
          await getDashboard(
            workspace.id,
            {
              month: 9,
              year: 2026,
            },
          );

        expect(
          dashboard.totalIncome.toString(),
        ).toBe('0');

        expect(
          dashboard.totalExpense.toString(),
        ).toBe('250');

        expect(
          dashboard.netResult.toString(),
        ).toBe('-250');

        expect(
          dashboard.savingsRate,
        ).toBeNull();
      },
    );
  },
);