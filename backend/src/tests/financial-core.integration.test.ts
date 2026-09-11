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
  archiveAccount,
  createAccount,
  listAccounts,
  updateAccount,
} from '../services/account.service.js';

import {
  createTransaction,
  updateTransaction,
  voidTransaction,
} from '../services/transaction.service.js';

import {
  createTransfer,
} from '../services/transfer.service.js';

const TEST_PREFIX =
  'FINPILOT_VITEST_CORE_';

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

  /*
   * LedgerEntry depende das
   * FinancialTransactions.
   *
   * Ao apagar as transações,
   * os lançamentos de ledger
   * associados são removidos.
   */
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

  await prisma.creditCardInstallmentPurchase.deleteMany({
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

async function getPostedBalance(
  workspaceId: string,
  accountId: string,
) {
  const entries =
    await prisma.ledgerEntry.findMany({
      where: {
        accountId,
        transaction: {
          workspaceId,
          status: 'POSTED',
        },
      },
      select: {
        type: true,
        amount: true,
      },
    });

  let balance =
    new Prisma.Decimal(0);

  for (
    const entry of entries
  ) {
    if (
      entry.type === 'CREDIT'
    ) {
      balance =
        balance.plus(
          entry.amount,
        );
    } else {
      balance =
        balance.minus(
          entry.amount,
        );
    }
  }

  return balance;
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
  'Financial core',
  () => {
    test(
      'creates an account and records its initial balance in the ledger',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta principal',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        expect(
          account.status,
        ).toBe('ACTIVE');

        expect(
          account.initialBalance.toString(),
        ).toBe('1000');

        const adjustment =
          await prisma.financialTransaction.findFirst({
            where: {
              workspaceId:
                workspace.id,
              type:
                'ADJUSTMENT',
              description:
                'Initial account balance',
            },
            include: {
              entries:
                true,
            },
          });

        expect(
          adjustment,
        ).not.toBeNull();

        expect(
          adjustment?.status,
        ).toBe('POSTED');

        expect(
          adjustment?.entries,
        ).toHaveLength(1);

        expect(
          adjustment?.entries[0]
            ?.accountId,
        ).toBe(account.id);

        expect(
          adjustment?.entries[0]
            ?.type,
        ).toBe('CREDIT');

        expect(
          adjustment?.entries[0]
            ?.amount.toString(),
        ).toBe('1000');

        const balance =
          await getPostedBalance(
            workspace.id,
            account.id,
          );

        expect(
          balance.toString(),
        ).toBe('1000');
      },
    );

    test(
      'records income and expense with the correct ledger entries and balance',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta movimento',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        const income =
          await createTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'INCOME',
            amount:
              500,
            description:
              'Receita teste',
            transactionDate:
              new Date(
                '2026-09-10T12:00:00.000Z',
              ),
          });

        const expense =
          await createTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'EXPENSE',
            amount:
              200,
            description:
              'Despesa teste',
            transactionDate:
              new Date(
                '2026-09-10T13:00:00.000Z',
              ),
          });

        const incomeEntry =
          await prisma.ledgerEntry.findFirstOrThrow({
            where: {
              transactionId:
                income.id,
            },
          });

        const expenseEntry =
          await prisma.ledgerEntry.findFirstOrThrow({
            where: {
              transactionId:
                expense.id,
            },
          });

        expect(
          incomeEntry.type,
        ).toBe('CREDIT');

        expect(
          incomeEntry.amount.toString(),
        ).toBe('500');

        expect(
          expenseEntry.type,
        ).toBe('DEBIT');

        expect(
          expenseEntry.amount.toString(),
        ).toBe('200');

        const balance =
          await getPostedBalance(
            workspace.id,
            account.id,
          );

        expect(
          balance.toString(),
        ).toBe('1300');
      },
    );

    test(
      'edits a transaction and updates its ledger entry without duplicating it',
      async () => {
        const workspace =
          await createTestWorkspace();

        const sourceAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta origem',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        const destinationAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta destino',
            type:
              'SAVINGS',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const transaction =
          await createTransaction({
            workspaceId:
              workspace.id,
            accountId:
              sourceAccount.id,
            type:
              'EXPENSE',
            amount:
              200,
            description:
              'Transação original',
            transactionDate:
              new Date(
                '2026-09-10T12:00:00.000Z',
              ),
          });

        const updated =
          await updateTransaction({
            workspaceId:
              workspace.id,
            transactionId:
              transaction.id,
            accountId:
              destinationAccount.id,
            type:
              'INCOME',
            amount:
              300,
            description:
              'Transação editada',
          });

        expect(
          updated,
        ).not.toBeNull();

        expect(
          updated?.type,
        ).toBe('INCOME');

        expect(
          updated?.description,
        ).toBe(
          'Transação editada',
        );

        expect(
          updated?.entries,
        ).toHaveLength(1);

        expect(
          updated?.entries[0]
            ?.accountId,
        ).toBe(
          destinationAccount.id,
        );

        expect(
          updated?.entries[0]
            ?.type,
        ).toBe('CREDIT');

        expect(
          updated?.entries[0]
            ?.amount.toString(),
        ).toBe('300');

        const entryCount =
          await prisma.ledgerEntry.count({
            where: {
              transactionId:
                transaction.id,
            },
          });

        expect(
          entryCount,
        ).toBe(1);

        const sourceBalance =
          await getPostedBalance(
            workspace.id,
            sourceAccount.id,
          );

        const destinationBalance =
          await getPostedBalance(
            workspace.id,
            destinationAccount.id,
          );

        expect(
          sourceBalance.toString(),
        ).toBe('1000');

        expect(
          destinationBalance.toString(),
        ).toBe('300');
      },
    );

    test(
      'voids a transaction without deleting its history and excludes it from posted balance',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta estorno',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        const transaction =
          await createTransaction({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            type:
              'EXPENSE',
            amount:
              200,
            description:
              'Despesa para estorno',
            transactionDate:
              new Date(
                '2026-09-10T12:00:00.000Z',
              ),
          });

        const balanceBeforeVoid =
          await getPostedBalance(
            workspace.id,
            account.id,
          );

        expect(
          balanceBeforeVoid.toString(),
        ).toBe('800');

        const voided =
          await voidTransaction({
            workspaceId:
              workspace.id,
            transactionId:
              transaction.id,
          });

        expect(
          voided.status,
        ).toBe('VOIDED');

        const ledgerEntry =
          await prisma.ledgerEntry.findFirst({
            where: {
              transactionId:
                transaction.id,
            },
          });

        expect(
          ledgerEntry,
        ).not.toBeNull();

        expect(
          ledgerEntry?.amount.toString(),
        ).toBe('200');

        const balanceAfterVoid =
          await getPostedBalance(
            workspace.id,
            account.id,
          );

        expect(
          balanceAfterVoid.toString(),
        ).toBe('1000');

        await expect(
          updateTransaction({
            workspaceId:
              workspace.id,
            transactionId:
              transaction.id,
            amount:
              250,
          }),
        ).rejects.toThrow(
          'Voided transactions cannot be edited',
        );
      },
    );

    test(
      'transfers money using one transaction and two balanced ledger entries',
      async () => {
        const workspace =
          await createTestWorkspace();

        const source =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Banco A',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        const destination =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Banco B',
            type:
              'SAVINGS',
            currency:
              'BRL',
            initialBalance:
              100,
          });

        const result =
          await createTransfer({
            workspaceId:
              workspace.id,
            sourceAccountId:
              source.id,
            destinationAccountId:
              destination.id,
            amount:
              250,
            description:
              'Transferência teste',
            transactionDate:
              new Date(
                '2026-09-10T14:00:00.000Z',
              ),
          });

        expect(
          result.transaction.type,
        ).toBe('TRANSFER');

        expect(
          result.transaction.status,
        ).toBe('POSTED');

        const transfer =
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
          transfer.entries,
        ).toHaveLength(2);

        const sourceEntry =
          transfer.entries.find(
            (entry) =>
              entry.accountId ===
              source.id,
          );

        const destinationEntry =
          transfer.entries.find(
            (entry) =>
              entry.accountId ===
              destination.id,
          );

        expect(
          sourceEntry?.type,
        ).toBe('DEBIT');

        expect(
          sourceEntry?.amount.toString(),
        ).toBe('250');

        expect(
          destinationEntry?.type,
        ).toBe('CREDIT');

        expect(
          destinationEntry?.amount.toString(),
        ).toBe('250');

        const sourceBalance =
          await getPostedBalance(
            workspace.id,
            source.id,
          );

        const destinationBalance =
          await getPostedBalance(
            workspace.id,
            destination.id,
          );

        expect(
          sourceBalance.toString(),
        ).toBe('750');

        expect(
          destinationBalance.toString(),
        ).toBe('350');
      },
    );

    test(
      'rejects a transfer with insufficient funds and rolls back completely',
      async () => {
        const workspace =
          await createTestWorkspace();

        const source =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta com pouco saldo',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              100,
          });

        const destination =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta destino vazia',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        await expect(
          createTransfer({
            workspaceId:
              workspace.id,
            sourceAccountId:
              source.id,
            destinationAccountId:
              destination.id,
            amount:
              150,
            description:
              'Transferência impossível',
            transactionDate:
              new Date(
                '2026-09-10T15:00:00.000Z',
              ),
          }),
        ).rejects.toThrow(
          'Insufficient funds',
        );

        const transferCount =
          await prisma.financialTransaction.count({
            where: {
              workspaceId:
                workspace.id,
              type:
                'TRANSFER',
            },
          });

        expect(
          transferCount,
        ).toBe(0);

        const sourceBalance =
          await getPostedBalance(
            workspace.id,
            source.id,
          );

        const destinationBalance =
          await getPostedBalance(
            workspace.id,
            destination.id,
          );

        expect(
          sourceBalance.toString(),
        ).toBe('100');

        expect(
          destinationBalance.toString(),
        ).toBe('0');
      },
    );

    test(
      'rejects invalid transfers and prevents generic transactions on credit card accounts',
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
              500,
          });

        const creditCardAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Cartão teste',
            type:
              'CREDIT_CARD',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        await expect(
          createTransfer({
            workspaceId:
              workspace.id,
            sourceAccountId:
              checking.id,
            destinationAccountId:
              checking.id,
            amount:
              10,
            description:
              'Mesma conta',
            transactionDate:
              new Date(
                '2026-09-10T16:00:00.000Z',
              ),
          }),
        ).rejects.toThrow(
          'Source and destination accounts must be different',
        );

        await expect(
          createTransfer({
            workspaceId:
              workspace.id,
            sourceAccountId:
              checking.id,
            destinationAccountId:
              creditCardAccount.id,
            amount:
              10,
            description:
              'Transferência para cartão',
            transactionDate:
              new Date(
                '2026-09-10T16:00:00.000Z',
              ),
          }),
        ).rejects.toThrow(
          'Credit card accounts cannot be used in transfers',
        );

        await expect(
          createTransaction({
            workspaceId:
              workspace.id,
            accountId:
              creditCardAccount.id,
            type:
              'EXPENSE',
            amount:
              50,
            description:
              'Compra inválida',
            transactionDate:
              new Date(
                '2026-09-10T16:00:00.000Z',
              ),
          }),
        ).rejects.toThrow(
          'Credit card transactions must use the credit card purchase endpoint',
        );
      },
    );

    test(
      'only archives zero-balance accounts and hides archived accounts by default',
      async () => {
        const workspace =
          await createTestWorkspace();

        const nonZeroAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta com saldo',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              100,
          });

        const zeroAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta zerada',
            type:
              'SAVINGS',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        await expect(
          archiveAccount({
            workspaceId:
              workspace.id,
            accountId:
              nonZeroAccount.id,
          }),
        ).rejects.toThrow(
          'Account balance must be zero before archiving',
        );

        const archived =
          await archiveAccount({
            workspaceId:
              workspace.id,
            accountId:
              zeroAccount.id,
          });

        expect(
          archived.status,
        ).toBe('ARCHIVED');

        const activeAccounts =
          await listAccounts(
            workspace.id,
          );

        expect(
          activeAccounts.some(
            (account) =>
              account.id ===
              zeroAccount.id,
          ),
        ).toBe(false);

        expect(
          activeAccounts.some(
            (account) =>
              account.id ===
              nonZeroAccount.id,
          ),
        ).toBe(true);

        const allAccounts =
          await listAccounts(
            workspace.id,
            true,
          );

        expect(
          allAccounts.some(
            (account) =>
              account.id ===
              zeroAccount.id &&
              account.status ===
                'ARCHIVED',
          ),
        ).toBe(true);
      },
    );

    test(
      'allows currency change before activity but blocks it after financial activity',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta moeda',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const changed =
          await updateAccount({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            currency:
              'USD',
          });

        expect(
          changed.currency,
        ).toBe('USD');

        await createTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          type:
            'INCOME',
          amount:
            100,
          description:
            'Primeira movimentação',
          transactionDate:
            new Date(
              '2026-09-10T17:00:00.000Z',
            ),
        });

        await expect(
          updateAccount({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            currency:
              'EUR',
          }),
        ).rejects.toThrow(
          'Account currency cannot be changed after financial activity',
        );

        const persistedAccount =
          await prisma.account.findUniqueOrThrow({
            where: {
              id:
                account.id,
            },
          });

        expect(
          persistedAccount.currency,
        ).toBe('USD');
      },
    );
  },
);