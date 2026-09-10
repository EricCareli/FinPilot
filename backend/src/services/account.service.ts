import { Prisma } from '../generated/prisma/client.js';

import type {
  AccountType,
  Currency,
} from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface CreateAccountInput {
  workspaceId: string;
  name: string;
  type: AccountType;
  currency: Currency;
  initialBalance: number;
}

export interface UpdateAccountInput {
  workspaceId: string;
  accountId: string;
  name?: string;
  type?: AccountType;
  currency?: Currency;
}

export interface ArchiveAccountInput {
  workspaceId: string;
  accountId: string;
}

export async function createAccount(
  input: CreateAccountInput,
) {
  const name = input.name.trim();

  if (name.length < 2) {
    throw new AppError(
      'Account name must contain at least 2 characters',
      400,
    );
  }

  if (
    !Number.isFinite(
      input.initialBalance,
    )
  ) {
    throw new AppError(
      'Initial balance must be a valid number',
      400,
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
            name,
            type: input.type,
            currency: input.currency,
            initialBalance,
          },
        });

      if (
        !initialBalance.isZero()
      ) {
        const transaction =
          await tx.financialTransaction.create({
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
          });

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
  includeArchived = false,
) {
  return prisma.account.findMany({
    where: {
      workspaceId,
      ...(includeArchived
        ? {}
        : {
            status: 'ACTIVE',
          }),
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function updateAccount(
  input: UpdateAccountInput,
) {
  if (
    input.name === undefined &&
    input.type === undefined &&
    input.currency === undefined
  ) {
    throw new AppError(
      'At least one account field must be provided',
      400,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const account =
        await tx.account.findFirst({
          where: {
            id: input.accountId,
            workspaceId:
              input.workspaceId,
          },
        });

      if (!account) {
        throw new AppError(
          'Account not found',
          404,
        );
      }

      if (
        account.status === 'ARCHIVED'
      ) {
        throw new AppError(
          'Archived accounts cannot be edited',
          400,
        );
      }

      let normalizedName:
        | string
        | undefined;

      if (input.name !== undefined) {
        normalizedName =
          input.name.trim();

        if (
          normalizedName.length < 2
        ) {
          throw new AppError(
            'Account name must contain at least 2 characters',
            400,
          );
        }
      }

      if (
        input.type !== undefined
      ) {
        if (
          account.type ===
            'CREDIT_CARD' &&
          input.type !==
            'CREDIT_CARD'
        ) {
          throw new AppError(
            'Credit card account type cannot be changed',
            400,
          );
        }

        if (
          account.type !==
            'CREDIT_CARD' &&
          input.type ===
            'CREDIT_CARD'
        ) {
          throw new AppError(
            'Account type cannot be changed to CREDIT_CARD through the account endpoint',
            400,
          );
        }
      }

      if (
        input.currency !== undefined &&
        input.currency !==
          account.currency
      ) {
        if (
          account.type ===
          'CREDIT_CARD'
        ) {
          throw new AppError(
            'Credit card currency cannot be changed through the account endpoint',
            400,
          );
        }

        const ledgerEntryCount =
          await tx.ledgerEntry.count({
            where: {
              accountId: account.id,
            },
          });

        if (
          ledgerEntryCount > 0
        ) {
          throw new AppError(
            'Account currency cannot be changed after financial activity',
            400,
          );
        }
      }

      return tx.account.update({
        where: {
          id: account.id,
        },
        data: {
          ...(normalizedName !==
          undefined
            ? {
                name:
                  normalizedName,
              }
            : {}),
          ...(input.type !==
          undefined
            ? {
                type: input.type,
              }
            : {}),
          ...(input.currency !==
          undefined
            ? {
                currency:
                  input.currency,
              }
            : {}),
        },
      });
    },
  );
}

export async function archiveAccount(
  input: ArchiveAccountInput,
) {
  return prisma.$transaction(
    async (tx) => {
      const account =
        await tx.account.findFirst({
          where: {
            id: input.accountId,
            workspaceId:
              input.workspaceId,
          },
        });

      if (!account) {
        throw new AppError(
          'Account not found',
          404,
        );
      }

      if (
        account.status === 'ARCHIVED'
      ) {
        throw new AppError(
          'Account is already archived',
          400,
        );
      }

      if (
        account.type ===
        'CREDIT_CARD'
      ) {
        throw new AppError(
          'Credit card accounts cannot be archived through the account endpoint',
          400,
        );
      }

      const recurringCount =
        await tx.recurringTransaction.count({
          where: {
            accountId: account.id,
            status: {
              in: [
                'ACTIVE',
                'PAUSED',
              ],
            },
          },
        });

      if (recurringCount > 0) {
        throw new AppError(
          'Account has active or paused recurring transactions',
          400,
        );
      }

      const entries =
        await tx.ledgerEntry.findMany({
          where: {
            accountId: account.id,
            transaction: {
              workspaceId:
                input.workspaceId,
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

      for (const entry of entries) {
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

      if (!balance.isZero()) {
        throw new AppError(
          'Account balance must be zero before archiving',
          400,
        );
      }

      return tx.account.update({
        where: {
          id: account.id,
        },
        data: {
          status: 'ARCHIVED',
        },
      });
    },
  );
}