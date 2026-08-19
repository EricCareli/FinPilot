import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export async function getDashboard(
  workspaceId: string,
) {
  const accounts = await prisma.account.findMany({
    where: {
      workspaceId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      currency: true,
    },
  });

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      account: {
        workspaceId,
        status: 'ACTIVE',
      },
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

  let totalBalance = new Prisma.Decimal(0);
  let totalIncome = new Prisma.Decimal(0);
  let totalExpense = new Prisma.Decimal(0);

  for (const entry of entries) {
    if (entry.type === 'CREDIT') {
      totalBalance = totalBalance.plus(entry.amount);
    } else {
      totalBalance = totalBalance.minus(entry.amount);
    }
  }

  const transactions =
    await prisma.financialTransaction.findMany({
      where: {
        workspaceId,
        status: 'POSTED',
        type: {
          in: ['INCOME', 'EXPENSE'],
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
      take: 10,
    });

  for (const transaction of transactions) {
    for (const entry of transaction.entries) {
      if (transaction.type === 'INCOME') {
        totalIncome = totalIncome.plus(entry.amount);
      }

      if (transaction.type === 'EXPENSE') {
        totalExpense = totalExpense.plus(entry.amount);
      }
    }
  }

  return {
    totalBalance,
    totalIncome,
    totalExpense,
    accountCount: accounts.length,
    accounts,
    recentTransactions: transactions,
  };
}