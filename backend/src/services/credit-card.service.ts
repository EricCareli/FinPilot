import { prisma } from '../lib/prisma.js';

export interface CreateCreditCardInput {
  workspaceId: string;
  accountId: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
}

export async function createCreditCard(
  input: CreateCreditCardInput,
) {
  const account = await prisma.account.findFirst({
    where: {
      id: input.accountId,
      workspaceId: input.workspaceId,
      status: 'ACTIVE',
    },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  if (account.type !== 'CREDIT_CARD') {
    throw new Error(
      'Account must be a credit card account',
    );
  }

  if (
    !Number.isFinite(input.creditLimit) ||
    input.creditLimit <= 0
  ) {
    throw new Error(
      'Credit limit must be greater than zero',
    );
  }

  if (
    !Number.isInteger(input.closingDay) ||
    input.closingDay < 1 ||
    input.closingDay > 31
  ) {
    throw new Error('Invalid closing day');
  }

  if (
    !Number.isInteger(input.dueDay) ||
    input.dueDay < 1 ||
    input.dueDay > 31
  ) {
    throw new Error('Invalid due day');
  }

  const existingCard =
    await prisma.creditCard.findUnique({
      where: {
        accountId: input.accountId,
      },
    });

  if (existingCard) {
    throw new Error(
      'Credit card already configured for this account',
    );
  }

  return prisma.creditCard.create({
    data: {
      accountId: input.accountId,
      creditLimit: input.creditLimit,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
    },
    include: {
      account: true,
    },
  });
}

export async function getCreditCard(
  workspaceId: string,
  accountId: string,
) {
  const card = await prisma.creditCard.findFirst({
    where: {
      accountId,
      account: {
        workspaceId,
        status: 'ACTIVE',
      },
    },
    include: {
      account: true,
    },
  });

  if (!card) {
    throw new Error('Credit card not found');
  }

  return card;
}