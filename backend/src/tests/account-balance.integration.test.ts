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
  getAccountBalance,
} from '../services/account-balance.service.js';

const TEST_PREFIX =
  'FINPILOT_BALANCE_TEST_';

async function createTestWorkspace() {
  return prisma.workspace.create({
    data: {
      name:
        `${TEST_PREFIX}${randomUUID()}`,
      type: 'BUSINESS',
    },
  });
}

async function createLedgerTransaction(
  input: {
    workspaceId: string;
    accountId: string;
    entryType:
      | 'CREDIT'
      | 'DEBIT';
    amount: number;
    status?:
      | 'POSTED'
      | 'VOIDED';
  },
) {
  return prisma.$transaction(
    async (tx) => {
      const transaction =
        await tx.financialTransaction.create({
          data: {
            workspaceId:
              input.workspaceId,
            categoryId: null,
            type: 'ADJUSTMENT',
            status:
              input.status ??
              'POSTED',
            description:
              `${TEST_PREFIX}ledger`,
            transactionDate:
              new Date(),
          },
        });

      await tx.ledgerEntry.create({
        data: {
          transactionId:
            transaction.id,
          accountId:
            input.accountId,
          type:
            input.entryType,
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

  await prisma.financialTransaction.deleteMany({
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
  'Account balance',
  () => {
    test(
      'returns the balance of an active account using posted ledger entries',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta saldo',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          entryType:
            'CREDIT',
          amount:
            500,
        });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          entryType:
            'DEBIT',
          amount:
            300,
        });

        const result =
          await getAccountBalance(
            workspace.id,
            account.id,
          );

        expect(
          result.accountId,
        ).toBe(account.id);

        expect(
          result.currency,
        ).toBe('BRL');

        expect(
          result.balance.toString(),
        ).toBe('1200');
      },
    );

    test(
      'ignores ledger entries from voided transactions',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta void',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              500,
          });

        await createLedgerTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          entryType:
            'DEBIT',
          amount:
            200,
          status:
            'VOIDED',
        });

        const result =
          await getAccountBalance(
            workspace.id,
            account.id,
          );

        expect(
          result.balance.toString(),
        ).toBe('500');
      },
    );

    test(
      'prevents access to an account from another workspace',
      async () => {
        const workspaceA =
          await createTestWorkspace();

        const workspaceB =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspaceA.id,
            name:
              'Conta privada',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              100,
          });

        await expect(
          getAccountBalance(
            workspaceB.id,
            account.id,
          ),
        ).rejects.toThrow(
          'Account not found',
        );
      },
    );

    test(
      'rejects archived accounts',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta arquivada',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        await prisma.account.update({
          where: {
            id:
              account.id,
          },
          data: {
            status:
              'ARCHIVED',
          },
        });

        await expect(
          getAccountBalance(
            workspace.id,
            account.id,
          ),
        ).rejects.toThrow(
          'Account not found',
        );
      },
    );
  },
);