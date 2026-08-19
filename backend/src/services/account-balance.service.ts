import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export async function getAccountBalance(
  workspaceId: string,
  accountId: string,
) {
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      workspaceId,
      status: 'ACTIVE',
    },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      accountId: account.id,
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

  let balance = new Prisma.Decimal(0);

  for (const entry of entries) {
    if (entry.type === 'CREDIT') {
      balance = balance.plus(entry.amount);
    } else {
      balance = balance.minus(entry.amount);
    }
  }

  return {
    accountId: account.id,
    currency: account.currency,
    balance,
  };
}