import { Prisma } from '../generated/prisma/client.js';
import type {
  TransactionType,
} from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface CreateTransactionInput {
  workspaceId: string;
  accountId: string;
  categoryId?: string;
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: Date;
}

export interface UpdateTransactionInput {
  workspaceId: string;
  transactionId: string;
  accountId?: string;
  categoryId?: string | null;
  type?: TransactionType;
  amount?: number;
  description?: string;
  transactionDate?: Date;
}

export interface VoidTransactionInput {
  workspaceId: string;
  transactionId: string;
}

function validateEditableTransactionType(
  type: TransactionType,
) {
  if (
    type !== 'INCOME' &&
    type !== 'EXPENSE'
  ) {
    throw new AppError(
      'Invalid transaction type',
      400,
    );
  }
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
      throw new AppError(
        'Account not found',
        404,
      );
    }

    if (account.type === 'CREDIT_CARD') {
      throw new AppError(
        'Credit card transactions must use the credit card purchase endpoint',
        400,
      );
    }

    if (
      !Number.isFinite(input.amount) ||
      input.amount <= 0
    ) {
      throw new AppError(
        'Amount must be greater than zero',
        400,
      );
    }

    const description =
      input.description.trim();

    if (!description) {
      throw new AppError(
        'Description is required',
        400,
      );
    }

    if (
      Number.isNaN(
        input.transactionDate.getTime(),
      )
    ) {
      throw new AppError(
        'Invalid transaction date',
        400,
      );
    }

    validateEditableTransactionType(
      input.type,
    );

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
        throw new AppError(
          'Category not found',
          404,
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
          description,
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
  includeVoided = false,
) {
  return prisma.financialTransaction.findMany({
    where: {
      workspaceId,
      ...(includeVoided
        ? {}
        : {
            status: {
              not: 'VOIDED',
            },
          }),
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

export async function updateTransaction(
  input: UpdateTransactionInput,
) {
  if (
    input.accountId === undefined &&
    input.categoryId === undefined &&
    input.type === undefined &&
    input.amount === undefined &&
    input.description === undefined &&
    input.transactionDate === undefined
  ) {
    throw new AppError(
      'At least one transaction field must be provided',
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    const transaction =
      await tx.financialTransaction.findFirst({
        where: {
          id: input.transactionId,
          workspaceId: input.workspaceId,
        },
        include: {
          entries: {
            include: {
              account: true,
            },
          },
        },
      });

    if (!transaction) {
      throw new AppError(
        'Transaction not found',
        404,
      );
    }

    if (transaction.status === 'VOIDED') {
      throw new AppError(
        'Voided transactions cannot be edited',
        400,
      );
    }

    if (transaction.status !== 'POSTED') {
      throw new AppError(
        'Only posted transactions can be edited',
        400,
      );
    }

    if (
      transaction.type !== 'INCOME' &&
      transaction.type !== 'EXPENSE'
    ) {
      throw new AppError(
        'Only income and expense transactions can be edited',
        400,
      );
    }

    if (transaction.entries.length !== 1) {
      throw new AppError(
        'Transaction ledger is inconsistent',
        409,
      );
    }

    const currentEntry =
      transaction.entries[0];

    if (!currentEntry) {
      throw new AppError(
        'Transaction ledger is inconsistent',
        409,
      );
    }

    if (
      transaction.invoiceId !== null ||
      currentEntry.account.type ===
        'CREDIT_CARD'
    ) {
      throw new AppError(
        'Credit card transactions must use the credit card endpoints',
        400,
      );
    }

    const nextType =
      input.type ?? transaction.type;

    validateEditableTransactionType(
      nextType,
    );

    let nextAccountId =
      currentEntry.accountId;

    if (input.accountId !== undefined) {
      const account =
        await tx.account.findFirst({
          where: {
            id: input.accountId,
            workspaceId: input.workspaceId,
            status: 'ACTIVE',
          },
        });

      if (!account) {
        throw new AppError(
          'Account not found',
          404,
        );
      }

      if (account.type === 'CREDIT_CARD') {
        throw new AppError(
          'Credit card transactions must use the credit card purchase endpoint',
          400,
        );
      }

      nextAccountId = account.id;
    }

    const nextCategoryId =
      input.categoryId !== undefined
        ? input.categoryId
        : transaction.categoryId;

    if (nextCategoryId !== null) {
      const category =
        await tx.category.findFirst({
          where: {
            id: nextCategoryId,
            workspaceId: input.workspaceId,
            type: nextType,
          },
        });

      if (!category) {
        throw new AppError(
          'Category not found',
          404,
        );
      }
    }

    let nextAmount =
      currentEntry.amount;

    if (input.amount !== undefined) {
      if (
        !Number.isFinite(input.amount) ||
        input.amount <= 0
      ) {
        throw new AppError(
          'Amount must be greater than zero',
          400,
        );
      }

      nextAmount = new Prisma.Decimal(
        input.amount,
      );
    }

    let nextDescription =
      transaction.description;

    if (input.description !== undefined) {
      nextDescription =
        input.description.trim();

      if (!nextDescription) {
        throw new AppError(
          'Description is required',
          400,
        );
      }
    }

    const nextTransactionDate =
      input.transactionDate ??
      transaction.transactionDate;

    if (
      Number.isNaN(
        nextTransactionDate.getTime(),
      )
    ) {
      throw new AppError(
        'Invalid transaction date',
        400,
      );
    }

    await tx.financialTransaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        categoryId: nextCategoryId,
        type: nextType,
        description: nextDescription,
        transactionDate:
          nextTransactionDate,
      },
    });

    await tx.ledgerEntry.update({
      where: {
        id: currentEntry.id,
      },
      data: {
        accountId: nextAccountId,
        type:
          nextType === 'INCOME'
            ? 'CREDIT'
            : 'DEBIT',
        amount: nextAmount,
      },
    });

    return tx.financialTransaction.findUnique({
      where: {
        id: transaction.id,
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
    });
  });
}

export async function voidTransaction(
  input: VoidTransactionInput,
) {
  return prisma.$transaction(async (tx) => {
    const transaction =
      await tx.financialTransaction.findFirst({
        where: {
          id: input.transactionId,
          workspaceId: input.workspaceId,
        },
        include: {
          entries: {
            include: {
              account: true,
            },
          },
        },
      });

    if (!transaction) {
      throw new AppError(
        'Transaction not found',
        404,
      );
    }

    if (transaction.status === 'VOIDED') {
      throw new AppError(
        'Transaction is already voided',
        400,
      );
    }

    if (
      transaction.type !== 'INCOME' &&
      transaction.type !== 'EXPENSE'
    ) {
      throw new AppError(
        'Only income and expense transactions can be voided',
        400,
      );
    }

    if (transaction.entries.length !== 1) {
      throw new AppError(
        'Transaction ledger is inconsistent',
        409,
      );
    }

    const currentEntry =
      transaction.entries[0];

    if (!currentEntry) {
      throw new AppError(
        'Transaction ledger is inconsistent',
        409,
      );
    }

    if (
      transaction.invoiceId !== null ||
      currentEntry.account.type ===
        'CREDIT_CARD'
    ) {
      throw new AppError(
        'Credit card transactions must use the credit card endpoints',
        400,
      );
    }

    return tx.financialTransaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        status: 'VOIDED',
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
    });
  });
}