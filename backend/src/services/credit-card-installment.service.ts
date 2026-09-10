import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface CreateCreditCardInstallmentPurchaseInput {
  workspaceId: string;
  accountId: string;
  categoryId?: string;
  totalAmount: number;
  description: string;
  installmentCount: number;
  purchaseDate: Date;
}

export interface VoidCreditCardInstallmentPurchaseInput {
  workspaceId: string;
  installmentPurchaseId: string;
}

function getLastDayOfMonth(
  year: number,
  month: number,
): number {
  return new Date(
    Date.UTC(
      year,
      month,
      0,
    ),
  ).getUTCDate();
}

function createSafeDate(
  year: number,
  month: number,
  day: number,
): Date {
  const safeDay =
    Math.min(
      day,
      getLastDayOfMonth(
        year,
        month,
      ),
    );

  return new Date(
    Date.UTC(
      year,
      month - 1,
      safeDay,
    ),
  );
}

function addMonthsSafe(
  date: Date,
  monthsToAdd: number,
): Date {
  const originalDay =
    date.getUTCDate();

  const target =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() +
          monthsToAdd,
        1,
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds(),
      ),
    );

  const lastDay =
    new Date(
      Date.UTC(
        target.getUTCFullYear(),
        target.getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();

  target.setUTCDate(
    Math.min(
      originalDay,
      lastDay,
    ),
  );

  return target;
}

function getInvoiceReference(
  closingDay: number,
  transactionDate: Date,
) {
  const transactionYear =
    transactionDate.getUTCFullYear();

  const transactionMonth =
    transactionDate.getUTCMonth() + 1;

  const transactionDay =
    transactionDate.getUTCDate();

  if (
    transactionDay <=
    closingDay
  ) {
    return {
      month:
        transactionMonth,
      year:
        transactionYear,
    };
  }

  let nextMonth =
    transactionMonth + 1;

  let nextYear =
    transactionYear;

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  return {
    month: nextMonth,
    year: nextYear,
  };
}

function addMonthsToInvoiceReference(
  month: number,
  year: number,
  monthsToAdd: number,
) {
  const absoluteMonth =
    year * 12 +
    (month - 1) +
    monthsToAdd;

  const targetYear =
    Math.floor(
      absoluteMonth / 12,
    );

  const targetMonth =
    (absoluteMonth % 12) + 1;

  return {
    month:
      targetMonth,
    year:
      targetYear,
  };
}

function getInvoiceDates(
  closingDay: number,
  dueDay: number,
  month: number,
  year: number,
) {
  const closingDate =
    createSafeDate(
      year,
      month,
      closingDay,
    );

  let dueMonth =
    month;

  let dueYear =
    year;

  if (
    dueDay <= closingDay
  ) {
    dueMonth += 1;

    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear += 1;
    }
  }

  const dueDate =
    createSafeDate(
      dueYear,
      dueMonth,
      dueDay,
    );

  return {
    closingDate,
    dueDate,
  };
}

export async function assertStandaloneCreditCardPurchase(
  workspaceId: string,
  transactionId: string,
) {
  const transaction =
    await prisma.financialTransaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
      },
      select: {
        installmentPurchaseId:
          true,
      },
    });

  if (
    transaction?.installmentPurchaseId
  ) {
    throw new AppError(
      'Installment purchases must use the installment purchase endpoints',
      400,
    );
  }
}

export async function createCreditCardInstallmentPurchase(
  input: CreateCreditCardInstallmentPurchaseInput,
) {
  if (
    !Number.isFinite(
      input.totalAmount,
    ) ||
    input.totalAmount <= 0
  ) {
    throw new AppError(
      'Total amount must be greater than zero',
      400,
    );
  }

  if (
    !Number.isInteger(
      input.installmentCount,
    ) ||
    input.installmentCount < 2 ||
    input.installmentCount > 36
  ) {
    throw new AppError(
      'Installment count must be between 2 and 36',
      400,
    );
  }

  const normalizedDescription =
    input.description.trim();

  if (!normalizedDescription) {
    throw new AppError(
      'Description is required',
      400,
    );
  }

  if (
    Number.isNaN(
      input.purchaseDate.getTime(),
    )
  ) {
    throw new AppError(
      'Invalid purchase date',
      400,
    );
  }

  const totalCents =
    Math.round(
      input.totalAmount * 100,
    );

  if (
    Math.abs(
      input.totalAmount * 100 -
        totalCents,
    ) > 0.000001
  ) {
    throw new AppError(
      'Total amount must have at most 2 decimal places',
      400,
    );
  }

  if (
    totalCents <
    input.installmentCount
  ) {
    throw new AppError(
      'Total amount is too small for the installment count',
      400,
    );
  }

  const totalAmount =
    new Prisma.Decimal(
      totalCents,
    ).div(100);

  const baseInstallmentCents =
    Math.floor(
      totalCents /
        input.installmentCount,
    );

  const remainderCents =
    totalCents %
    input.installmentCount;

  return prisma.$transaction(
    async (tx) => {
      const creditCard =
        await tx.creditCard.findFirst({
          where: {
            accountId:
              input.accountId,
            account: {
              workspaceId:
                input.workspaceId,
              status: 'ACTIVE',
              type: 'CREDIT_CARD',
            },
          },
          include: {
            account: true,
          },
        });

      if (!creditCard) {
        throw new AppError(
          'Credit card not found',
          404,
        );
      }

      if (input.categoryId) {
        const category =
          await tx.category.findFirst({
            where: {
              id:
                input.categoryId,
              workspaceId:
                input.workspaceId,
              type: 'EXPENSE',
            },
          });

        if (!category) {
          throw new AppError(
            'Category not found',
            404,
          );
        }
      }

      /*
       * Limite utilizado:
       *
       * DEBIT consome limite.
       * CREDIT libera limite.
       *
       * Todas as parcelas são lançadas
       * imediatamente, então o valor
       * total da compra consome o limite
       * no momento da criação.
       */
      const cardEntries =
        await tx.ledgerEntry.findMany({
          where: {
            accountId:
              input.accountId,
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

      let usedLimit =
        new Prisma.Decimal(0);

      for (
        const entry of
          cardEntries
      ) {
        if (
          entry.type ===
          'DEBIT'
        ) {
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

      if (
        usedLimit.isNegative()
      ) {
        usedLimit =
          new Prisma.Decimal(0);
      }

      const creditLimit =
        new Prisma.Decimal(
          creditCard.creditLimit,
        );

      const projectedUsedLimit =
        usedLimit.plus(
          totalAmount,
        );

      if (
        projectedUsedLimit.gt(
          creditLimit,
        )
      ) {
        throw new AppError(
          'Insufficient credit card limit',
          400,
        );
      }

      const firstInvoiceReference =
        getInvoiceReference(
          creditCard.closingDay,
          input.purchaseDate,
        );

      const installments: Array<{
        installmentNumber: number;
        amount: Prisma.Decimal;
        transactionDate: Date;
        invoiceId: string;
        referenceMonth: number;
        referenceYear: number;
      }> = [];

      /*
       * Cada parcela recebe uma fatura
       * diferente.
       *
       * Não recalculamos a referência
       * usando somente a data deslocada,
       * porque compras feitas em dias
       * como 29, 30 ou 31 poderiam fazer
       * duas parcelas caírem na mesma
       * fatura em meses mais curtos.
       */
      for (
        let index = 0;
        index <
        input.installmentCount;
        index++
      ) {
        const installmentNumber =
          index + 1;

        const installmentCents =
          baseInstallmentCents +
          (
            index <
            remainderCents
              ? 1
              : 0
          );

        const amount =
          new Prisma.Decimal(
            installmentCents,
          ).div(100);

        const reference =
          addMonthsToInvoiceReference(
            firstInvoiceReference.month,
            firstInvoiceReference.year,
            index,
          );

        const transactionDate =
          addMonthsSafe(
            input.purchaseDate,
            index,
          );

        let invoice =
          await tx.creditCardInvoice.findUnique({
            where: {
              creditCardId_referenceMonth_referenceYear:
                {
                  creditCardId:
                    creditCard.id,
                  referenceMonth:
                    reference.month,
                  referenceYear:
                    reference.year,
                },
            },
          });

        if (
          invoice &&
          invoice.status !==
            'OPEN'
        ) {
          throw new AppError(
            `Invoice ${reference.month}/${reference.year} is not open`,
            400,
          );
        }

        if (!invoice) {
          const {
            closingDate,
            dueDate,
          } = getInvoiceDates(
            creditCard.closingDay,
            creditCard.dueDay,
            reference.month,
            reference.year,
          );

          invoice =
            await tx.creditCardInvoice.create({
              data: {
                creditCardId:
                  creditCard.id,
                referenceMonth:
                  reference.month,
                referenceYear:
                  reference.year,
                closingDate,
                dueDate,
                totalAmount:
                  new Prisma.Decimal(
                    0,
                  ),
                status: 'OPEN',
              },
            });
        }

        installments.push({
          installmentNumber,
          amount,
          transactionDate,
          invoiceId:
            invoice.id,
          referenceMonth:
            reference.month,
          referenceYear:
            reference.year,
        });
      }

      const installmentPurchase =
        await tx.creditCardInstallmentPurchase.create({
          data: {
            workspaceId:
              input.workspaceId,
            creditCardId:
              creditCard.id,
            categoryId:
              input.categoryId ??
              null,
            description:
              normalizedDescription,
            totalAmount,
            installmentCount:
              input.installmentCount,
            purchaseDate:
              input.purchaseDate,
            status: 'ACTIVE',
          },
        });

      for (
        const installment of
          installments
      ) {
        const transaction =
          await tx.financialTransaction.create({
            data: {
              workspaceId:
                input.workspaceId,
              categoryId:
                input.categoryId ??
                null,
              invoiceId:
                installment.invoiceId,
              installmentPurchaseId:
                installmentPurchase.id,
              installmentNumber:
                installment.installmentNumber,
              type: 'EXPENSE',
              status: 'POSTED',
              description:
                `${normalizedDescription} (${installment.installmentNumber}/${input.installmentCount})`,
              transactionDate:
                installment.transactionDate,
            },
          });

        await tx.ledgerEntry.create({
          data: {
            transactionId:
              transaction.id,
            accountId:
              input.accountId,
            type: 'DEBIT',
            amount:
              installment.amount,
          },
        });

        await tx.creditCardInvoice.update({
          where: {
            id:
              installment.invoiceId,
          },
          data: {
            totalAmount: {
              increment:
                installment.amount,
            },
          },
        });
      }

      const result =
        await tx.creditCardInstallmentPurchase.findUnique({
          where: {
            id:
              installmentPurchase.id,
          },
          include: {
            creditCard: {
              include: {
                account: true,
              },
            },
            category: true,
            transactions: {
              include: {
                invoice: true,
                entries: true,
              },
              orderBy: {
                installmentNumber:
                  'asc',
              },
            },
          },
        });

      if (!result) {
        throw new AppError(
          'Installment purchase not found',
          404,
        );
      }

      return result;
    },
  );
}

export async function listCreditCardInstallmentPurchases(
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
      select: {
        id: true,
      },
    });

  if (!creditCard) {
    throw new AppError(
      'Credit card not found',
      404,
    );
  }

  return prisma.creditCardInstallmentPurchase.findMany({
    where: {
      workspaceId,
      creditCardId:
        creditCard.id,
    },
    include: {
      category: true,
      transactions: {
        include: {
          invoice: true,
          entries: true,
        },
        orderBy: {
          installmentNumber:
            'asc',
        },
      },
    },
    orderBy: {
      purchaseDate: 'desc',
    },
  });
}

export async function getCreditCardInstallmentPurchase(
  workspaceId: string,
  installmentPurchaseId: string,
) {
  const installmentPurchase =
    await prisma.creditCardInstallmentPurchase.findFirst({
      where: {
        id:
          installmentPurchaseId,
        workspaceId,
      },
      include: {
        creditCard: {
          include: {
            account: true,
          },
        },
        category: true,
        transactions: {
          include: {
            invoice: true,
            entries: true,
          },
          orderBy: {
            installmentNumber:
              'asc',
          },
        },
      },
    });

  if (!installmentPurchase) {
    throw new AppError(
      'Installment purchase not found',
      404,
    );
  }

  return installmentPurchase;
}

export async function voidCreditCardInstallmentPurchase(
  input: VoidCreditCardInstallmentPurchaseInput,
) {
  return prisma.$transaction(
    async (tx) => {
      const installmentPurchase =
        await tx.creditCardInstallmentPurchase.findFirst({
          where: {
            id:
              input.installmentPurchaseId,
            workspaceId:
              input.workspaceId,
          },
          include: {
            creditCard: {
              include: {
                account: true,
              },
            },
            transactions: {
              include: {
                invoice: true,
                entries: true,
              },
              orderBy: {
                installmentNumber:
                  'asc',
              },
            },
          },
        });

      if (!installmentPurchase) {
        throw new AppError(
          'Installment purchase not found',
          404,
        );
      }

      if (
        installmentPurchase.status ===
        'VOIDED'
      ) {
        throw new AppError(
          'Installment purchase is already voided',
          400,
        );
      }

      if (
        installmentPurchase.transactions.length !==
        installmentPurchase.installmentCount
      ) {
        throw new AppError(
          'Installment purchase is inconsistent',
          409,
        );
      }

      /*
       * Por enquanto o estorno completo
       * só é permitido enquanto todas
       * as faturas envolvidas estiverem
       * OPEN.
       *
       * Depois podemos implementar
       * REFUND para compras que já
       * tiveram parcelas pagas.
       */
      for (
        const transaction of
          installmentPurchase.transactions
      ) {
        if (
          transaction.status !==
          'POSTED'
        ) {
          throw new AppError(
            'Installment purchase contains a non-posted installment',
            409,
          );
        }

        if (
          !transaction.invoice
        ) {
          throw new AppError(
            'Installment invoice not found',
            409,
          );
        }

        if (
          transaction.invoice.status !==
          'OPEN'
        ) {
          throw new AppError(
            'Installment purchase cannot be voided because one or more invoices are not open',
            400,
          );
        }

        const debitEntries =
          transaction.entries.filter(
            (entry) =>
              entry.accountId ===
                installmentPurchase
                  .creditCard
                  .accountId &&
              entry.type ===
                'DEBIT',
          );

        if (
          debitEntries.length !== 1
        ) {
          throw new AppError(
            'Installment ledger is inconsistent',
            409,
          );
        }

        const debitEntry =
          debitEntries[0];

        if (!debitEntry) {
          throw new AppError(
            'Installment ledger is inconsistent',
            409,
          );
        }

        if (
          transaction.invoice.totalAmount.lt(
            debitEntry.amount,
          )
        ) {
          throw new AppError(
            'Installment invoice total is inconsistent',
            409,
          );
        }
      }

      for (
        const transaction of
          installmentPurchase.transactions
      ) {
        const debitEntry =
          transaction.entries.find(
            (entry) =>
              entry.accountId ===
                installmentPurchase
                  .creditCard
                  .accountId &&
              entry.type ===
                'DEBIT',
          );

        if (
          !debitEntry ||
          !transaction.invoice
        ) {
          throw new AppError(
            'Installment purchase is inconsistent',
            409,
          );
        }

        await tx.financialTransaction.update({
          where: {
            id:
              transaction.id,
          },
          data: {
            status: 'VOIDED',
          },
        });

        await tx.creditCardInvoice.update({
          where: {
            id:
              transaction.invoice.id,
          },
          data: {
            totalAmount: {
              decrement:
                debitEntry.amount,
            },
          },
        });
      }

      await tx.creditCardInstallmentPurchase.update({
        where: {
          id:
            installmentPurchase.id,
        },
        data: {
          status: 'VOIDED',
        },
      });

      const result =
        await tx.creditCardInstallmentPurchase.findUnique({
          where: {
            id:
              installmentPurchase.id,
          },
          include: {
            creditCard: {
              include: {
                account: true,
              },
            },
            category: true,
            transactions: {
              include: {
                invoice: true,
                entries: true,
              },
              orderBy: {
                installmentNumber:
                  'asc',
              },
            },
          },
        });

      if (!result) {
        throw new AppError(
          'Installment purchase not found',
          404,
        );
      }

      return result;
    },
  );
}