import { prisma } from '../lib/prisma.js';
import type {
  TransactionType,
} from '../generated/prisma/client.js';

export interface CreateTransactionInput {
  workspaceId: string;
  accountId: string;
  categoryId?: string;
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: Date;
}

export async function createTransaction(
  input: CreateTransactionInput,
) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: {
        id: input.accountId,
        workspaceId: input.workspaceId,
        status: 'ACTIVE',
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    if (input.categoryId) {
      const category = await tx.category.findFirst({
        where: {
          id: input.categoryId,
          workspaceId: input.workspaceId,
        },
      });

      if (!category) {
        throw new Error('Category not found');
      }
    }

    const transaction = await tx.financialTransaction.create({
      data: {
        workspaceId: input.workspaceId,
        categoryId: input.categoryId ?? null,
        type: input.type,
        status: 'POSTED',
        description: input.description,
        transactionDate: input.transactionDate,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: account.id,
        type:
          input.type === 'INCOME'
            ? 'CREDIT'
            : 'DEBIT',
        amount: input.amount,
      },
    });

    return transaction;
  });
}

export async function listTransactions(
  workspaceId: string,
) {
  return prisma.financialTransaction.findMany({
    where: {
      workspaceId,
      status: {
        not: 'VOIDED',
      },
    },
    include: {
      category: true,
      entries: {
        include: {
          account: true,
        },
      },
    },
    orderBy: {
      transactionDate: 'desc',
    },
  });
}