import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';

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
    throw new Error(
      'Credit card not found',
    );
  }

  const transactions =
    await prisma.financialTransaction.findMany({
      where: {
        workspaceId,
        type: 'EXPENSE',
        status: 'POSTED',
        entries: {
          some: {
            accountId,
            type: 'DEBIT',
          },
        },
      },
      include: {
        entries: {
          where: {
            accountId,
            type: 'DEBIT',
          },
          select: {
            amount: true,
          },
        },
      },
    });

  let usedLimit =
    new Prisma.Decimal(0);

  for (const transaction of transactions) {
    for (const entry of transaction.entries) {
      usedLimit = usedLimit.plus(
        entry.amount,
      );
    }
  }

  const paidInvoices =
    await prisma.creditCardInvoice.findMany({
      where: {
        creditCardId: creditCard.id,
        status: 'PAID',
      },
      select: {
        totalAmount: true,
      },
    });

  let paidAmount =
    new Prisma.Decimal(0);

  for (const invoice of paidInvoices) {
    paidAmount = paidAmount.plus(
      invoice.totalAmount,
    );
  }

  usedLimit = usedLimit.minus(
    paidAmount,
  );

  if (usedLimit.isNegative()) {
    usedLimit = new Prisma.Decimal(0);
  }

  const creditLimit =
    new Prisma.Decimal(
      creditCard.creditLimit,
    );

  const availableLimit =
    creditLimit.minus(usedLimit);

  return {
    accountId,
    creditLimit,
    usedLimit,
    availableLimit,
  };
}