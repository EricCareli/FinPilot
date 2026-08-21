import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface DashboardPeriod {
  month?: number;
  year?: number;
}

export async function getDashboard(
  workspaceId: string,
  period: DashboardPeriod = {},
) {
  const hasMonth = period.month !== undefined;
  const hasYear = period.year !== undefined;

  if (
    hasMonth &&
    (period.month! < 1 || period.month! > 12)
  ) {
    throw new Error('Month must be between 1 and 12');
  }

  if (
    hasYear &&
    (!Number.isInteger(period.year) || period.year! < 2000)
  ) {
    throw new Error('Invalid year');
  }

  if (hasMonth !== hasYear) {
    throw new Error(
      'Month and year must be provided together',
    );
  }

  let periodStart: Date | undefined;
  let periodEnd: Date | undefined;

  if (hasMonth && hasYear) {
    periodStart = new Date(
      Date.UTC(
        period.year!,
        period.month! - 1,
        1,
      ),
    );

    periodEnd = new Date(
      Date.UTC(
        period.year!,
        period.month!,
        1,
      ),
    );
  }

  const accounts = await prisma.account.findMany({
    where: {
      workspaceId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      initialBalance: true,
      entries: {
        where: {
          transaction: {
            workspaceId,
            status: 'POSTED',
          },
        },
        select: {
          type: true,
          amount: true,
        },
      },
      creditCard: {
        select: {
          id: true,
          creditLimit: true,
          closingDay: true,
          dueDay: true,
        },
      },
    },
  });

  let totalBalance = new Prisma.Decimal(0);

  const accountBalances = accounts.map(
    (account) => {
      let balance = new Prisma.Decimal(
        account.initialBalance,
      );

      for (const entry of account.entries) {
        if (entry.type === 'CREDIT') {
          balance = balance.plus(entry.amount);
        } else {
          balance = balance.minus(entry.amount);
        }
      }

      if (account.type !== 'CREDIT_CARD') {
        totalBalance =
          totalBalance.plus(balance);
      }

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balance,
      };
    },
  );

  const transactionPeriodFilter =
    periodStart && periodEnd
      ? {
          transactionDate: {
            gte: periodStart,
            lt: periodEnd,
          },
        }
      : {};

  const financialTransactions =
    await prisma.financialTransaction.findMany({
      where: {
        workspaceId,
        status: 'POSTED',
        type: {
          in: ['INCOME', 'EXPENSE'],
        },
        ...transactionPeriodFilter,
      },
      select: {
        id: true,
        type: true,
        description: true,
        transactionDate: true,
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        entries: {
          select: {
            amount: true,
          },
        },
      },
    });

  let totalIncome = new Prisma.Decimal(0);
  let totalExpense = new Prisma.Decimal(0);

  const expenseByCategoryMap = new Map<
    string,
    {
      categoryId: string | null;
      categoryName: string;
      amount: Prisma.Decimal;
    }
  >();

  for (const transaction of financialTransactions) {
    let transactionAmount =
      new Prisma.Decimal(0);

    for (const entry of transaction.entries) {
      transactionAmount =
        transactionAmount.plus(entry.amount);
    }

    if (transaction.type === 'INCOME') {
      totalIncome =
        totalIncome.plus(transactionAmount);
    }

    if (transaction.type === 'EXPENSE') {
      totalExpense =
        totalExpense.plus(transactionAmount);

      const categoryId =
        transaction.category?.id ?? null;

      const categoryName =
        transaction.category?.name ??
        'Sem categoria';

      const mapKey =
        categoryId ?? 'uncategorized';

      const existing =
        expenseByCategoryMap.get(mapKey);

      if (existing) {
        existing.amount =
          existing.amount.plus(
            transactionAmount,
          );
      } else {
        expenseByCategoryMap.set(mapKey, {
          categoryId,
          categoryName,
          amount: transactionAmount,
        });
      }
    }
  }

  const expenseByCategory = Array.from(
    expenseByCategoryMap.values(),
  )
    .sort((a, b) =>
      b.amount.comparedTo(a.amount),
    )
    .map((category) => {
      const percentage =
        totalExpense.isZero()
          ? new Prisma.Decimal(0)
          : category.amount
              .mul(100)
              .div(totalExpense);

      return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        amount: category.amount,
        percentage,
      };
    });

  let totalCreditLimit = new Prisma.Decimal(0);
  let totalCreditUsed = new Prisma.Decimal(0);
  let totalCreditAvailable =
    new Prisma.Decimal(0);

  const creditCards = accounts
    .filter(
      (account) =>
        account.type === 'CREDIT_CARD' &&
        account.creditCard !== null,
    )
    .map((account) => {
      const creditCard = account.creditCard!;

      let usedLimit = new Prisma.Decimal(0);

      for (const entry of account.entries) {
        if (entry.type === 'DEBIT') {
          usedLimit =
            usedLimit.plus(entry.amount);
        }
      }

      const creditLimit =
        new Prisma.Decimal(
          creditCard.creditLimit,
        );

      const availableLimit =
        creditLimit.minus(usedLimit);

      totalCreditLimit =
        totalCreditLimit.plus(creditLimit);

      totalCreditUsed =
        totalCreditUsed.plus(usedLimit);

      totalCreditAvailable =
        totalCreditAvailable.plus(
          availableLimit,
        );

      return {
        id: creditCard.id,
        accountId: account.id,
        name: account.name,
        currency: account.currency,
        creditLimit,
        usedLimit,
        availableLimit,
        closingDay: creditCard.closingDay,
        dueDay: creditCard.dueDay,
      };
    });

  const recentTransactions =
    await prisma.financialTransaction.findMany({
      where: {
        workspaceId,
        status: 'POSTED',
        type: {
          in: ['INCOME', 'EXPENSE'],
        },
        ...transactionPeriodFilter,
      },
      select: {
        id: true,
        type: true,
        description: true,
        transactionDate: true,
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        entries: {
          select: {
            amount: true,
            account: {
              select: {
                id: true,
                name: true,
                type: true,
                currency: true,
              },
            },
          },
        },
      },
      orderBy: {
        transactionDate: 'desc',
      },
      take: 10,
    });

  const netResult =
    totalIncome.minus(totalExpense);

  return {
    period:
      hasMonth && hasYear
        ? {
            month: period.month,
            year: period.year,
          }
        : null,

    totalBalance,
    totalIncome,
    totalExpense,
    netResult,

    expenseByCategory,

    accountCount: accounts.length,
    accounts: accountBalances,

    creditCards: {
      count: creditCards.length,
      totalCreditLimit,
      totalCreditUsed,
      totalCreditAvailable,
      cards: creditCards,
    },

    recentTransactions,
  };
}