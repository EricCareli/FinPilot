import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import type {
  AccountType,
  Currency,
} from '../generated/prisma/client.js';

export interface CreateAccountInput {
  workspaceId: string;
  name: string;
  type: AccountType;
  currency: Currency;
  initialBalance: number;
}

export async function createAccount(
  input: CreateAccountInput,
) {
  if (!input.name.trim()) {
    throw new Error(
      'Account name is required',
    );
  }

  if (
    !Number.isFinite(
      input.initialBalance,
    )
  ) {
    throw new Error(
      'Initial balance must be a valid number',
    );
  }

  const initialBalance =
    new Prisma.Decimal(
      input.initialBalance,
    );

  return prisma.$transaction(
    async (tx) => {
      const account =
        await tx.account.create({
          data: {
            workspaceId:
              input.workspaceId,
            name: input.name.trim(),
            type: input.type,
            currency: input.currency,
            initialBalance,
          },
        });

      if (
        !initialBalance.isZero()
      ) {
        const transaction =
          await tx.financialTransaction.create(
            {
              data: {
                workspaceId:
                  input.workspaceId,
                type: 'ADJUSTMENT',
                status: 'POSTED',
                description:
                  'Initial account balance',
                transactionDate:
                  new Date(),
              },
            },
          );

        await tx.ledgerEntry.create({
          data: {
            transactionId:
              transaction.id,
            accountId:
              account.id,
            type:
              initialBalance.gt(0)
                ? 'CREDIT'
                : 'DEBIT',
            amount:
              initialBalance.abs(),
          },
        });
      }

      return account;
    },
  );
}

export async function listAccounts(
  workspaceId: string,
) {
  return prisma.account.findMany({
    where: {
      workspaceId,
      status: 'ACTIVE',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}