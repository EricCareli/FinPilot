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
  const hasMonth =
    period.month !== undefined;

  const hasYear =
    period.year !== undefined;

  if (
    hasMonth &&
    (period.month! < 1 ||
      period.month! > 12)
  ) {
    throw new Error(
      'Month must be between 1 and 12',
    );
  }

  if (
    hasYear &&
    (!Number.isInteger(period.year) ||
      period.year! < 2000)
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

  const accounts =
    await prisma.account.findMany({
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

  let totalBalance =
    new Prisma.Decimal(0);

  const accountBalances =
    accounts.map((account) => {
      let balance =
        new Prisma.Decimal(
          account.initialBalance,
        );

      for (const entry of account.entries) {
        if (entry.type === 'CREDIT') {
          balance =
            balance.plus(entry.amount);
        } else {
          balance =
            balance.minus(entry.amount);
        }
      }

      if (
        account.type !== 'CREDIT_CARD'
      ) {
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
    });

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
    await prisma.financialTransaction.findMany(
      {
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
      },
    );

  let totalIncome =
    new Prisma.Decimal(0);

  let totalExpense =
    new Prisma.Decimal(0);

  const expenseByCategoryMap =
    new Map<
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
        transactionAmount.plus(
          entry.amount,
        );
    }

    if (transaction.type === 'INCOME') {
      totalIncome =
        totalIncome.plus(
          transactionAmount,
        );
    }

    if (transaction.type === 'EXPENSE') {
      totalExpense =
        totalExpense.plus(
          transactionAmount,
        );

      const categoryId =
        transaction.category?.id ?? null;

      const categoryName =
        transaction.category?.name ??
        'Sem categoria';

      const mapKey =
        categoryId ?? 'uncategorized';

      const existing =
        expenseByCategoryMap.get(
          mapKey,
        );

      if (existing) {
        existing.amount =
          existing.amount.plus(
            transactionAmount,
          );
      } else {
        expenseByCategoryMap.set(
          mapKey,
          {
            categoryId,
            categoryName,
            amount: transactionAmount,
          },
        );
      }
    }
  }

  const expenseByCategory =
    Array.from(
      expenseByCategoryMap.values(),
    )
      .sort((a, b) =>
        b.amount.comparedTo(
          a.amount,
        ),
      )
      .map((category) => {
        const percentage =
          totalExpense.isZero()
            ? new Prisma.Decimal(0)
            : category.amount
                .mul(100)
                .div(totalExpense);

        return {
          categoryId:
            category.categoryId,
          categoryName:
            category.categoryName,
          amount: category.amount,
          percentage,
        };
      });

  /*
   * Evolução financeira dos últimos
   * 6 meses.
   */

  const currentDate =
    new Date();

  const monthlyStart =
    new Date(
      Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth() - 5,
        1,
      ),
    );

  const monthlyTransactions =
    await prisma.financialTransaction.findMany(
      {
        where: {
          workspaceId,
          status: 'POSTED',
          type: {
            in: ['INCOME', 'EXPENSE'],
          },
          transactionDate: {
            gte: monthlyStart,
          },
        },
        select: {
          type: true,
          transactionDate: true,
          entries: {
            select: {
              amount: true,
            },
          },
        },
        orderBy: {
          transactionDate: 'asc',
        },
      },
    );

  const monthlyMap =
    new Map<
      string,
      {
        month: number;
        year: number;
        income: Prisma.Decimal;
        expense: Prisma.Decimal;
      }
    >();

  for (
    let index = 0;
    index < 6;
    index++
  ) {
    const date =
      new Date(
        Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth() -
            index,
          1,
        ),
      );

    const month =
      date.getUTCMonth() + 1;

    const year =
      date.getUTCFullYear();

    const key =
      `${year}-${month}`;

    monthlyMap.set(key, {
      month,
      year,
      income:
        new Prisma.Decimal(0),
      expense:
        new Prisma.Decimal(0),
    });
  }

  for (
    const transaction of
      monthlyTransactions
  ) {
    const month =
      transaction.transactionDate
        .getUTCMonth() + 1;

    const year =
      transaction.transactionDate
        .getUTCFullYear();

    const key =
      `${year}-${month}`;

    const monthlyData =
      monthlyMap.get(key);

    if (!monthlyData) {
      continue;
    }

    let amount =
      new Prisma.Decimal(0);

    for (
      const entry of
        transaction.entries
    ) {
      amount =
        amount.plus(entry.amount);
    }

    if (
      transaction.type ===
      'INCOME'
    ) {
      monthlyData.income =
        monthlyData.income.plus(
          amount,
        );
    }

    if (
      transaction.type ===
      'EXPENSE'
    ) {
      monthlyData.expense =
        monthlyData.expense.plus(
          amount,
        );
    }
  }

  const monthlyEvolution =
    Array.from(
      monthlyMap.values(),
    )
      .sort((a, b) => {
        if (a.year !== b.year) {
          return a.year - b.year;
        }

        return a.month - b.month;
      })
      .map((month) => ({
        month: month.month,
        year: month.year,
        income: month.income,
        expense: month.expense,
        netResult:
          month.income.minus(
            month.expense,
          ),
      }));

  const netResult =
    totalIncome.minus(
      totalExpense,
    );

  let savingsRate:
    | Prisma.Decimal
    | null = null;

  if (!totalIncome.isZero()) {
    savingsRate =
      netResult
        .mul(100)
        .div(totalIncome);
  }

  let previousMonth:
    | {
        month: number;
        year: number;
        income: Prisma.Decimal;
        expense: Prisma.Decimal;
        netResult: Prisma.Decimal;
      }
    | null = null;

  let comparison:
    | {
        incomeChange:
          | Prisma.Decimal
          | null;
        expenseChange:
          | Prisma.Decimal
          | null;
        netResultChange:
          | Prisma.Decimal
          | null;
      }
    | null = null;

  if (hasMonth && hasYear) {
    const previousMonthDate =
      new Date(
        Date.UTC(
          period.year!,
          period.month! - 2,
          1,
        ),
      );

    const previousMonthEnd =
      new Date(
        Date.UTC(
          period.year!,
          period.month! - 1,
          1,
        ),
      );

    const previousMonthTransactions =
      await prisma.financialTransaction.findMany(
        {
          where: {
            workspaceId,
            status: 'POSTED',
            type: {
              in: [
                'INCOME',
                'EXPENSE',
              ],
            },
            transactionDate: {
              gte:
                previousMonthDate,
              lt:
                previousMonthEnd,
            },
          },
          select: {
            type: true,
            entries: {
              select: {
                amount: true,
              },
            },
          },
        },
      );

    let previousIncome =
      new Prisma.Decimal(0);

    let previousExpense =
      new Prisma.Decimal(0);

    for (
      const transaction of
        previousMonthTransactions
    ) {
      let amount =
        new Prisma.Decimal(0);

      for (
        const entry of
          transaction.entries
      ) {
        amount =
          amount.plus(
            entry.amount,
          );
      }

      if (
        transaction.type ===
        'INCOME'
      ) {
        previousIncome =
          previousIncome.plus(
            amount,
          );
      }

      if (
        transaction.type ===
        'EXPENSE'
      ) {
        previousExpense =
          previousExpense.plus(
            amount,
          );
      }
    }

    const previousNetResult =
      previousIncome.minus(
        previousExpense,
      );

    previousMonth = {
      month:
        previousMonthDate
          .getUTCMonth() + 1,
      year:
        previousMonthDate
          .getUTCFullYear(),
      income: previousIncome,
      expense: previousExpense,
      netResult:
        previousNetResult,
    };

    const calculateChange = (
      current: Prisma.Decimal,
      previous: Prisma.Decimal,
    ): Prisma.Decimal | null => {
      if (previous.isZero()) {
        return null;
      }

      return current
        .minus(previous)
        .mul(100)
        .div(previous);
    };

    comparison = {
      incomeChange:
        calculateChange(
          totalIncome,
          previousIncome,
        ),
      expenseChange:
        calculateChange(
          totalExpense,
          previousExpense,
        ),
      netResultChange:
        calculateChange(
          netResult,
          previousNetResult,
        ),
    };
  }

  /*
   * Budgets do Dashboard.
   */

  let budgets: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    month: number;
    year: number;
    budget: Prisma.Decimal;
    spent: Prisma.Decimal;
    remaining: Prisma.Decimal;
    percentageUsed: Prisma.Decimal;
    status:
      | 'ON_TRACK'
      | 'WARNING'
      | 'EXCEEDED';
  }> = [];

  if (
    hasMonth &&
    hasYear &&
    periodStart &&
    periodEnd
  ) {
    const dashboardBudgets =
      await prisma.budget.findMany({
        where: {
          workspaceId,
          month: period.month!,
          year: period.year!,
        },
        select: {
          id: true,
          categoryId: true,
          amount: true,
          month: true,
          year: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          category: {
            name: 'asc',
          },
        },
      });

    const budgetCategoryIds =
      dashboardBudgets.map(
        (budget) =>
          budget.categoryId,
      );

    const budgetTransactions =
      budgetCategoryIds.length > 0
        ? await prisma.financialTransaction.findMany(
            {
              where: {
                workspaceId,
                status: 'POSTED',
                type: 'EXPENSE',
                categoryId: {
                  in: budgetCategoryIds,
                },
                transactionDate: {
                  gte: periodStart,
                  lt: periodEnd,
                },
              },
              select: {
                categoryId: true,
                entries: {
                  select: {
                    type: true,
                    amount: true,
                  },
                },
              },
            },
          )
        : [];

    const spentByCategory =
      new Map<
        string,
        Prisma.Decimal
      >();

    for (
      const transaction of
        budgetTransactions
    ) {
      if (!transaction.categoryId) {
        continue;
      }

      let transactionAmount =
        new Prisma.Decimal(0);

      for (
        const entry of
          transaction.entries
      ) {
        if (entry.type === 'DEBIT') {
          transactionAmount =
            transactionAmount.plus(
              entry.amount,
            );
        }
      }

      const current =
        spentByCategory.get(
          transaction.categoryId,
        ) ??
        new Prisma.Decimal(0);

      spentByCategory.set(
        transaction.categoryId,
        current.plus(
          transactionAmount,
        ),
      );
    }

    budgets =
      dashboardBudgets.map(
        (budget) => {
          const spent =
            spentByCategory.get(
              budget.categoryId,
            ) ??
            new Prisma.Decimal(0);

          const remaining =
            budget.amount.minus(
              spent,
            );

          const percentageUsed =
            budget.amount.isZero()
              ? new Prisma.Decimal(0)
              : spent
                  .mul(100)
                  .div(
                    budget.amount,
                  );

          let status:
            | 'ON_TRACK'
            | 'WARNING'
            | 'EXCEEDED';

          if (
            percentageUsed.greaterThanOrEqualTo(
              100,
            )
          ) {
            status = 'EXCEEDED';
          } else if (
            percentageUsed.greaterThanOrEqualTo(
              80,
            )
          ) {
            status = 'WARNING';
          } else {
            status = 'ON_TRACK';
          }

          return {
            id: budget.id,
            categoryId:
              budget.categoryId,
            categoryName:
              budget.category.name,
            month: budget.month,
            year: budget.year,
            budget: budget.amount,
            spent,
            remaining,
            percentageUsed,
            status,
          };
        },
      );
  }

  let totalCreditLimit =
    new Prisma.Decimal(0);

  let totalCreditUsed =
    new Prisma.Decimal(0);

  let totalCreditAvailable =
    new Prisma.Decimal(0);

  const creditCards =
    accounts
      .filter(
        (account) =>
          account.type ===
            'CREDIT_CARD' &&
          account.creditCard !==
            null,
      )
      .map((account) => {
        const creditCard =
          account.creditCard!;

        let usedLimit =
          new Prisma.Decimal(0);

        for (
          const entry of
            account.entries
        ) {
          if (
            entry.type === 'DEBIT'
          ) {
            usedLimit =
              usedLimit.plus(
                entry.amount,
              );
          }
        }

        const creditLimit =
          new Prisma.Decimal(
            creditCard.creditLimit,
          );

        const availableLimit =
          creditLimit.minus(
            usedLimit,
          );

        totalCreditLimit =
          totalCreditLimit.plus(
            creditLimit,
          );

        totalCreditUsed =
          totalCreditUsed.plus(
            usedLimit,
          );

        totalCreditAvailable =
          totalCreditAvailable.plus(
            availableLimit,
          );

        return {
          id: creditCard.id,
          accountId:
            account.id,
          name: account.name,
          currency:
            account.currency,
          creditLimit,
          usedLimit,
          availableLimit,
          closingDay:
            creditCard.closingDay,
          dueDay:
            creditCard.dueDay,
        };
      });

  const recentTransactions =
    await prisma.financialTransaction.findMany(
      {
        where: {
          workspaceId,
          status: 'POSTED',
          type: {
            in: [
              'INCOME',
              'EXPENSE',
            ],
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
      },
    );

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

    savingsRate,

    previousMonth,

    comparison,

    expenseByCategory,

    monthlyEvolution,

    budgets,

    accountCount:
      accounts.length,

    accounts: accountBalances,

    creditCards: {
      count:
        creditCards.length,
      totalCreditLimit,
      totalCreditUsed,
      totalCreditAvailable,
      cards: creditCards,
    },

    recentTransactions,
  };
}