import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export async function getCreditCardLimit(
  workspaceId: string,
  accountId: string,
) {
  const creditCard = await prisma.creditCard.findFirst({
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
    throw new Error('Credit card not found');
  }

  const openInvoices =
    await prisma.creditCardInvoice.findMany({
      where: {
        creditCardId: creditCard.id,
        status: {
          in: ['OPEN', 'CLOSED', 'OVERDUE'],
        },
      },
      select: {
        totalAmount: true,
      },
    });

  let usedLimit = new Prisma.Decimal(0);

  for (const invoice of openInvoices) {
    usedLimit = usedLimit.plus(invoice.totalAmount);
  }

  const creditLimit = new Prisma.Decimal(
    creditCard.creditLimit,
  );

  const availableLimit = creditLimit.minus(
    usedLimit,
  );

  return {
    accountId,
    creditLimit,
    usedLimit,
    availableLimit,
  };
}