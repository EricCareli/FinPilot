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
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        type: input.type,
        currency: input.currency,
        initialBalance: input.initialBalance,
      },
    });

    if (input.initialBalance !== 0) {
      const transaction = await tx.financialTransaction.create({
        data: {
          workspaceId: input.workspaceId,
          type: 'ADJUSTMENT',
          status: 'POSTED',
          description: 'Initial account balance',
          transactionDate: new Date(),
        },
      });

      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: account.id,
          type:
            input.initialBalance > 0
              ? 'CREDIT'
              : 'DEBIT',
          amount: Math.abs(input.initialBalance),
        },
      });
    }

    return account;
  });
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