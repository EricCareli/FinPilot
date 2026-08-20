import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface CreateTransferInput {
  workspaceId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  description: string;
  transactionDate: Date;
}

export async function createTransfer(
  input: CreateTransferInput,
) {
  if (
    input.sourceAccountId ===
    input.destinationAccountId
  ) {
    throw new Error(
      'Source and destination accounts must be different',
    );
  }

  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    throw new Error(
      'Transfer amount must be greater than zero',
    );
  }

  if (!input.description.trim()) {
    throw new Error('Description is required');
  }

  if (
    Number.isNaN(input.transactionDate.getTime())
  ) {
    throw new Error('Invalid transaction date');
  }

  return prisma.$transaction(async (tx) => {
    const sourceAccount =
      await tx.account.findFirst({
        where: {
          id: input.sourceAccountId,
          workspaceId: input.workspaceId,
          status: 'ACTIVE',
        },
      });

    if (!sourceAccount) {
      throw new Error('Source account not found');
    }

    const destinationAccount =
      await tx.account.findFirst({
        where: {
          id: input.destinationAccountId,
          workspaceId: input.workspaceId,
          status: 'ACTIVE',
        },
      });

    if (!destinationAccount) {
      throw new Error(
        'Destination account not found',
      );
    }

    if (
      sourceAccount.currency !==
      destinationAccount.currency
    ) {
      throw new Error(
        'Source and destination accounts must use the same currency',
      );
    }

    const amount = new Prisma.Decimal(
      input.amount,
    );

    const entries =
      await tx.ledgerEntry.findMany({
        where: {
          accountId: sourceAccount.id,
          transaction: {
            workspaceId: input.workspaceId,
            status: 'POSTED',
          },
        },
        select: {
          type: true,
          amount: true,
        },
      });

    let sourceBalance = new Prisma.Decimal(
      sourceAccount.initialBalance,
    );

    for (const entry of entries) {
      if (entry.type === 'CREDIT') {
        sourceBalance =
          sourceBalance.plus(entry.amount);
      } else {
        sourceBalance =
          sourceBalance.minus(entry.amount);
      }
    }

    if (sourceBalance.lessThan(amount)) {
      throw new Error('Insufficient funds');
    }

    const transaction =
      await tx.financialTransaction.create({
        data: {
          workspaceId: input.workspaceId,
          categoryId: null,
          type: 'TRANSFER',
          status: 'POSTED',
          description: input.description.trim(),
          transactionDate: input.transactionDate,
        },
      });

    await tx.ledgerEntry.createMany({
      data: [
        {
          transactionId: transaction.id,
          accountId: sourceAccount.id,
          type: 'DEBIT',
          amount,
        },
        {
          transactionId: transaction.id,
          accountId: destinationAccount.id,
          type: 'CREDIT',
          amount,
        },
      ],
    });

    return {
      transaction,
      amount,
      sourceAccountId: sourceAccount.id,
      destinationAccountId:
        destinationAccount.id,
    };
  });
}