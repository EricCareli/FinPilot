import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface CreateCreditCardPurchaseInput {
  workspaceId: string;
  accountId: string;
  categoryId?: string;
  amount: number;
  description: string;
  transactionDate: Date;
}

export async function createCreditCardPurchase(
  input: CreateCreditCardPurchaseInput,
) {
  return prisma.$transaction(async (tx) => {
    const creditCard = await tx.creditCard.findFirst({
      where: {
        accountId: input.accountId,
        account: {
          workspaceId: input.workspaceId,
          status: 'ACTIVE',
          type: 'CREDIT_CARD',
        },
      },
    });

    if (!creditCard) {
      throw new Error('Credit card not found');
    }

    if (
      !Number.isFinite(input.amount) ||
      input.amount <= 0
    ) {
      throw new Error(
        'Purchase amount must be greater than zero',
      );
    }

    if (!input.description.trim()) {
      throw new Error('Description is required');
    }

    if (input.categoryId) {
      const category = await tx.category.findFirst({
        where: {
          id: input.categoryId,
          workspaceId: input.workspaceId,
          type: 'EXPENSE',
        },
      });

      if (!category) {
        throw new Error('Category not found');
      }
    }

    const debitEntries =
      await tx.ledgerEntry.findMany({
        where: {
          accountId: input.accountId,
          type: 'DEBIT',
          transaction: {
            workspaceId: input.workspaceId,
            status: 'POSTED',
            type: 'EXPENSE',
          },
        },
        select: {
          amount: true,
        },
      });

    let usedLimit = new Prisma.Decimal(0);

    for (const entry of debitEntries) {
      usedLimit = usedLimit.plus(entry.amount);
    }

    const creditLimit = new Prisma.Decimal(
      creditCard.creditLimit,
    );

    const purchaseAmount = new Prisma.Decimal(
      input.amount,
    );

    const availableLimit =
      creditLimit.minus(usedLimit);

    if (purchaseAmount.gt(availableLimit)) {
      throw new Error('Insufficient credit limit');
    }

    const transaction =
      await tx.financialTransaction.create({
        data: {
          workspaceId: input.workspaceId,
          categoryId: input.categoryId ?? null,
          type: 'EXPENSE',
          status: 'POSTED',
          description: input.description.trim(),
          transactionDate: input.transactionDate,
        },
      });

    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: input.accountId,
        type: 'DEBIT',
        amount: purchaseAmount,
      },
    });

    return transaction;
  });
}