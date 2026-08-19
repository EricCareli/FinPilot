import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface PayCreditCardInvoiceInput {
  workspaceId: string;
  invoiceId: string;
  paymentAccountId: string;
  paymentDate: Date;
}

export async function payCreditCardInvoice(
  input: PayCreditCardInvoiceInput,
) {
  return prisma.$transaction(async (tx) => {
    const invoice =
      await tx.creditCardInvoice.findFirst({
        where: {
          id: input.invoiceId,
          creditCard: {
            account: {
              workspaceId: input.workspaceId,
              status: 'ACTIVE',
            },
          },
        },
        include: {
          creditCard: {
            include: {
              account: true,
            },
          },
        },
      });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'OPEN') {
      throw new Error('Invoice is not open');
    }

    const paymentAccount =
      await tx.account.findFirst({
        where: {
          id: input.paymentAccountId,
          workspaceId: input.workspaceId,
          status: 'ACTIVE',
        },
      });

    if (!paymentAccount) {
      throw new Error('Payment account not found');
    }

    if (paymentAccount.type === 'CREDIT_CARD') {
      throw new Error(
        'Payment account cannot be a credit card',
      );
    }

    if (
      paymentAccount.currency !==
      invoice.creditCard.account.currency
    ) {
      throw new Error(
        'Payment account currency does not match invoice currency',
      );
    }

    const paymentAmount = new Prisma.Decimal(
      invoice.totalAmount,
    );

    const entries =
      await tx.ledgerEntry.findMany({
        where: {
          accountId: paymentAccount.id,
          transaction: {
            workspaceId: input.workspaceId,
            status: 'POSTED',
          },
        },
        select: {
          type: true,
          amount: true,
        },
      });

    let balance = new Prisma.Decimal(
      paymentAccount.initialBalance,
    );

    for (const entry of entries) {
      if (entry.type === 'CREDIT') {
        balance = balance.plus(entry.amount);
      } else {
        balance = balance.minus(entry.amount);
      }
    }

    if (balance.lt(paymentAmount)) {
      throw new Error('Insufficient funds');
    }

    const transaction =
      await tx.financialTransaction.create({
        data: {
          workspaceId: input.workspaceId,
          categoryId: null,
          type: 'TRANSFER',
          status: 'POSTED',
          description: `Pagamento da fatura do cartão ${invoice.creditCard.account.name}`,
          transactionDate: input.paymentDate,
        },
      });

    await tx.ledgerEntry.createMany({
      data: [
        {
          transactionId: transaction.id,
          accountId: paymentAccount.id,
          type: 'DEBIT',
          amount: paymentAmount,
        },
        {
          transactionId: transaction.id,
          accountId: invoice.creditCard.accountId,
          type: 'CREDIT',
          amount: paymentAmount,
        },
      ],
    });

    const paidInvoice =
      await tx.creditCardInvoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          status: 'PAID',
        },
      });

    return {
      invoice: paidInvoice,
      transaction,
      paymentAmount,
    };
  });
}