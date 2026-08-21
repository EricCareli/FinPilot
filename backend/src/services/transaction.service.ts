import { Prisma } from '../generated/prisma/client.js';
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

    if (account.type === 'CREDIT_CARD') {
      throw new Error(
        'Credit card transactions must use the credit card purchase endpoint',
      );
    }

    if (
      !Number.isFinite(input.amount) ||
      input.amount <= 0
    ) {
      throw new Error(
        'Amount must be greater than zero',
      );
    }

    if (!input.description.trim()) {
      throw new Error('Description is required');
    }

    if (
      Number.isNaN(
        input.transactionDate.getTime(),
      )
    ) {
      throw new Error(
        'Invalid transaction date',
      );
    }

    if (
      input.type !== 'INCOME' &&
      input.type !== 'EXPENSE'
    ) {
      throw new Error(
        'Invalid transaction type',
      );
    }

    if (input.categoryId) {
      const category =
        await tx.category.findFirst({
          where: {
            id: input.categoryId,
            workspaceId: input.workspaceId,
            type: input.type,
          },
        });

      if (!category) {
        throw new Error(
          'Category not found',
        );
      }
    }

    const amount = new Prisma.Decimal(
      input.amount,
    );

    const transaction =
      await tx.financialTransaction.create({
        data: {
          workspaceId: input.workspaceId,
          categoryId:
            input.categoryId ?? null,
          type: input.type,
          status: 'POSTED',
          description:
            input.description.trim(),
          transactionDate:
            input.transactionDate,
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
        amount,
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
      invoice: true,
    },
    orderBy: {
      transactionDate: 'desc',
    },
  });
}