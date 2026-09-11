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
  createCategory,
} from '../services/category.service.js';

import {
  cancelRecurringTransaction,
  createRecurringTransaction,
  executeRecurringTransaction,
  listRecurringTransactions,
  pauseRecurringTransaction,
  processDueRecurringTransactions,
  resumeRecurringTransaction,
  updateRecurringTransaction,
} from '../services/recurring-transaction.service.js';

const TEST_PREFIX =
  'FINPILOT_RECURRING_TEST_';

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
  'Recurring transactions',
  () => {
    test(
      'creates an active recurring transaction with next run equal to start date',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta recorrente',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Salário recorrente',
            type:
              'INCOME',
          });

        const startDate =
          new Date(
            '2027-01-10T12:00:00.000Z',
          );

        const recurring =
          await createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            categoryId:
              category.id,
            type:
              'INCOME',
            amount:
              1000,
            description:
              'Salário mensal',
            frequency:
              'MONTHLY',
            startDate,
          });

        expect(
          recurring.status,
        ).toBe('ACTIVE');

        expect(
          recurring.amount.toString(),
        ).toBe('1000');

        expect(
          recurring.type,
        ).toBe('INCOME');

        expect(
          recurring.frequency,
        ).toBe('MONTHLY');

        expect(
          recurring.startDate.toISOString(),
        ).toBe(
          startDate.toISOString(),
        );

        expect(
          recurring.nextRunDate.toISOString(),
        ).toBe(
          startDate.toISOString(),
        );

        expect(
          recurring.endDate,
        ).toBeNull();
      },
    );

    test(
      'rejects mismatched categories and credit card accounts',
      async () => {
        const workspace =
          await createTestWorkspace();

        const checking =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta corrente',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const creditCard =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Cartão recorrente',
            type:
              'CREDIT_CARD',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const incomeCategory =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Receita recorrente',
            type:
              'INCOME',
          });

        await expect(
          createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              checking.id,
            categoryId:
              incomeCategory.id,
            type:
              'EXPENSE',
            amount:
              100,
            description:
              'Categoria incompatível',
            frequency:
              'MONTHLY',
            startDate:
              new Date(),
          }),
        ).rejects.toThrow(
          'Category type must match recurring transaction type',
        );

        await expect(
          createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              creditCard.id,
            type:
              'EXPENSE',
            amount:
              100,
            description:
              'Cartão inválido',
            frequency:
              'MONTHLY',
            startDate:
              new Date(),
          }),
        ).rejects.toThrow(
          'Recurring transactions cannot use credit card accounts',
        );
      },
    );

    test(
      'updates recurring transaction financial and scheduling fields',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta atualização',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Assinaturas',
            type:
              'EXPENSE',
          });

        const recurring =
          await createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            categoryId:
              category.id,
            type:
              'EXPENSE',
            amount:
              100,
            description:
              'Assinatura antiga',
            frequency:
              'MONTHLY',
            startDate:
              new Date(
                '2027-01-01T12:00:00.000Z',
              ),
          });

        const nextRunDate =
          new Date(
            '2027-02-01T12:00:00.000Z',
          );

        const endDate =
          new Date(
            '2027-12-31T12:00:00.000Z',
          );

        const updated =
          await updateRecurringTransaction({
            workspaceId:
              workspace.id,
            recurringTransactionId:
              recurring.id,
            amount:
              150,
            description:
              'Assinatura atualizada',
            frequency:
              'WEEKLY',
            nextRunDate,
            endDate,
          });

        expect(
          updated.amount.toString(),
        ).toBe('150');

        expect(
          updated.description,
        ).toBe(
          'Assinatura atualizada',
        );

        expect(
          updated.frequency,
        ).toBe('WEEKLY');

        expect(
          updated.nextRunDate.toISOString(),
        ).toBe(
          nextRunDate.toISOString(),
        );

        expect(
          updated.endDate?.toISOString(),
        ).toBe(
          endDate.toISOString(),
        );

        expect(
          updated.category?.id,
        ).toBe(category.id);
      },
    );

    test(
      'pauses resumes and cancels a recurring transaction',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta status',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const recurring =
          await createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'INCOME',
            amount:
              500,
            description:
              'Receita status',
            frequency:
              'MONTHLY',
            startDate:
              new Date(
                Date.now() +
                  24 * 60 * 60 * 1000,
              ),
          });

        const paused =
          await pauseRecurringTransaction(
            workspace.id,
            recurring.id,
          );

        expect(
          paused?.status,
        ).toBe('PAUSED');

        await expect(
          executeRecurringTransaction(
            workspace.id,
            recurring.id,
          ),
        ).rejects.toThrow(
          'Recurring transaction is not active',
        );

        const resumed =
          await resumeRecurringTransaction(
            workspace.id,
            recurring.id,
          );

        expect(
          resumed?.status,
        ).toBe('ACTIVE');

        const cancelled =
          await cancelRecurringTransaction(
            workspace.id,
            recurring.id,
          );

        expect(
          cancelled?.status,
        ).toBe('CANCELLED');

        const listed =
          await listRecurringTransactions(
            workspace.id,
          );

        expect(
          listed.some(
            (item) =>
              item.id === recurring.id,
          ),
        ).toBe(false);

        await expect(
          updateRecurringTransaction({
            workspaceId:
              workspace.id,
            recurringTransactionId:
              recurring.id,
            amount:
              600,
          }),
        ).rejects.toThrow(
          'Cancelled recurring transactions cannot be edited',
        );
      },
    );

    test(
      'executes a due income recurrence and creates a posted credit ledger entry',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta receita',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Receita automática',
            type:
              'INCOME',
          });

        const scheduledDate =
          new Date(
            Date.now() -
              60 * 1000,
          );

        const recurring =
          await createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            categoryId:
              category.id,
            type:
              'INCOME',
            amount:
              700,
            description:
              'Receita automática',
            frequency:
              'DAILY',
            startDate:
              scheduledDate,
          });

        const result =
          await executeRecurringTransaction(
            workspace.id,
            recurring.id,
          );

        expect(
          result.transaction.type,
        ).toBe('INCOME');

        expect(
          result.transaction.status,
        ).toBe('POSTED');

        expect(
          result.transaction.transactionDate.toISOString(),
        ).toBe(
          scheduledDate.toISOString(),
        );

        const persisted =
          await prisma.financialTransaction.findUniqueOrThrow({
            where: {
              id:
                result.transaction.id,
            },
            include: {
              entries:
                true,
            },
          });

        expect(
          persisted.entries,
        ).toHaveLength(1);

        expect(
          persisted.entries[0]?.accountId,
        ).toBe(account.id);

        expect(
          persisted.entries[0]?.type,
        ).toBe('CREDIT');

        expect(
          persisted.entries[0]?.amount.toString(),
        ).toBe('700');

        const expectedNextRun =
          new Date(
            scheduledDate.getTime(),
          );

        expectedNextRun.setUTCDate(
          expectedNextRun.getUTCDate() +
            1,
        );

        expect(
          result.recurringTransaction
            .nextRunDate
            .toISOString(),
        ).toBe(
          expectedNextRun.toISOString(),
        );
      },
    );

    test(
      'executes a due expense recurrence with a debit ledger entry',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta despesa',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Despesa automática',
            type:
              'EXPENSE',
          });

        const recurring =
          await createRecurringTransaction({
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
              'Despesa automática',
            frequency:
              'WEEKLY',
            startDate:
              new Date(
                Date.now() -
                  60 * 1000,
              ),
          });

        const result =
          await executeRecurringTransaction(
            workspace.id,
            recurring.id,
          );

        const entry =
          await prisma.ledgerEntry.findFirstOrThrow({
            where: {
              transactionId:
                result.transaction.id,
            },
          });

        expect(
          entry.type,
        ).toBe('DEBIT');

        expect(
          entry.amount.toString(),
        ).toBe('250');
      },
    );

    test(
      'rejects execution before the recurring transaction is due',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta futura',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const recurring =
          await createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'INCOME',
            amount:
              100,
            description:
              'Receita futura',
            frequency:
              'DAILY',
            startDate:
              new Date(
                Date.now() +
                  24 * 60 * 60 * 1000,
              ),
          });

        await expect(
          executeRecurringTransaction(
            workspace.id,
            recurring.id,
          ),
        ).rejects.toThrow(
          'Recurring transaction is not due yet',
        );

        const generatedTransactions =
          await prisma.financialTransaction.count({
            where: {
              workspaceId:
                workspace.id,
              description:
                'Receita futura',
            },
          });

        expect(
          generatedTransactions,
        ).toBe(0);
      },
    );

    test(
      'adjusts a monthly recurrence from January 31 to the last day of February',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta mensal',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const scheduledDate =
          new Date(
            '2026-01-31T12:00:00.000Z',
          );

        const recurring =
          await createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'INCOME',
            amount:
              100,
            description:
              'Recorrência mensal',
            frequency:
              'MONTHLY',
            startDate:
              scheduledDate,
          });

        const result =
          await executeRecurringTransaction(
            workspace.id,
            recurring.id,
          );

        expect(
          result.recurringTransaction
            .nextRunDate
            .toISOString(),
        ).toBe(
          '2026-02-28T12:00:00.000Z',
        );
      },
    );

    test(
      'executes the final recurrence and automatically cancels after the end date',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta final',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const scheduledDate =
          new Date(
            Date.now() -
              60 * 1000,
          );

        const recurring =
          await createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'INCOME',
            amount:
              200,
            description:
              'Última recorrência',
            frequency:
              'DAILY',
            startDate:
              scheduledDate,
            endDate:
              scheduledDate,
          });

        const result =
          await executeRecurringTransaction(
            workspace.id,
            recurring.id,
          );

        expect(
          result.transaction.status,
        ).toBe('POSTED');

        expect(
          result.recurringTransaction
            .status,
        ).toBe('CANCELLED');

        const generatedTransactions =
          await prisma.financialTransaction.count({
            where: {
              workspaceId:
                workspace.id,
              description:
                'Última recorrência',
            },
          });

        expect(
          generatedTransactions,
        ).toBe(1);

        const listed =
          await listRecurringTransactions(
            workspace.id,
          );

        expect(
          listed.some(
            (item) =>
              item.id === recurring.id,
          ),
        ).toBe(false);
      },
    );

    test(
      'processes overdue recurrences up to the requested execution limit',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta processamento',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const startDate =
          new Date(
            Date.now() -
              5 *
                24 *
                60 *
                60 *
                1000,
          );

        const recurring =
          await createRecurringTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'INCOME',
            amount:
              50,
            description:
              'Receita atrasada',
            frequency:
              'DAILY',
            startDate,
          });

        const result =
          await processDueRecurringTransactions(
            workspace.id,
            2,
          );

        expect(
          result.processedCount,
        ).toBe(2);

        expect(
          result.failedCount,
        ).toBe(0);

        expect(
          result.hasMoreDue,
        ).toBe(true);

        expect(
          result.processed,
        ).toHaveLength(2);

        expect(
          result.processed.every(
            (item) =>
              item.recurringTransactionId ===
              recurring.id,
          ),
        ).toBe(true);

        const generatedTransactions =
          await prisma.financialTransaction.findMany({
            where: {
              workspaceId:
                workspace.id,
              description:
                'Receita atrasada',
              type:
                'INCOME',
            },
            orderBy: {
              transactionDate:
                'asc',
            },
          });

        expect(
          generatedTransactions,
        ).toHaveLength(2);

        const persistedRecurring =
          await prisma.recurringTransaction.findUniqueOrThrow({
            where: {
              id:
                recurring.id,
            },
          });

        const expectedNextRun =
          new Date(
            startDate.getTime(),
          );

        expectedNextRun.setUTCDate(
          expectedNextRun.getUTCDate() +
            2,
        );

        expect(
          persistedRecurring
            .nextRunDate
            .toISOString(),
        ).toBe(
          expectedNextRun.toISOString(),
        );

        expect(
          persistedRecurring.status,
        ).toBe('ACTIVE');
      },
    );

    test(
      'rejects invalid recurring processing limits',
      async () => {
        const workspace =
          await createTestWorkspace();

        await expect(
          processDueRecurringTransactions(
            workspace.id,
            0,
          ),
        ).rejects.toThrow(
          'Invalid recurring processing limit',
        );

        await expect(
          processDueRecurringTransactions(
            workspace.id,
            501,
          ),
        ).rejects.toThrow(
          'Invalid recurring processing limit',
        );
      },
    );
  },
);