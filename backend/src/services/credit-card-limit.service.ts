import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export async function getCreditCardLimit(
  workspaceId: string,
  accountId: string,
) {
  const creditCard =
    await prisma.creditCard.findFirst({
      where: {
        accountId,
        account: {
          workspaceId,
          status: 'ACTIVE',
          type: 'CREDIT_CARD',
        },
      },
    });

  if (!creditCard) {
    throw new AppError(
      'Credit card not found',
      404,
    );
  }

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

  let usedLimit =
    new Prisma.Decimal(0);

  for (const entry of entries) {
    if (entry.type === 'DEBIT') {
      usedLimit =
        usedLimit.plus(
          entry.amount,
        );
    } else {
      usedLimit =
        usedLimit.minus(
          entry.amount,
        );
    }
  }

  if (usedLimit.isNegative()) {
    usedLimit =
      new Prisma.Decimal(0);
  }

  const creditLimit =
    new Prisma.Decimal(
      creditCard.creditLimit,
    );

  let availableLimit =
    creditLimit.minus(
      usedLimit,
    );

  if (availableLimit.isNegative()) {
    availableLimit =
      new Prisma.Decimal(0);
  }

  return {
    accountId,
    creditLimit,
    usedLimit,
    availableLimit,
  };
}