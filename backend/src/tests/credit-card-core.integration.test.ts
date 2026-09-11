import { randomUUID } from 'node:crypto';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'vitest';

import {
  prisma,
} from '../lib/prisma.js';

import {
  createAccount,
} from '../services/account.service.js';

import {
  createCategory,
} from '../services/category.service.js';

import {
  createCreditCard,
  getCreditCard,
} from '../services/credit-card.service.js';

import {
  createCreditCardPurchase,
  updateCreditCardPurchase,
  voidCreditCardPurchase,
} from '../services/credit-card-purchase.service.js';

import {
  payCreditCardInvoice,
} from '../services/credit-card-payment.service.js';

const TEST_PREFIX =
  'FINPILOT_CARD_CORE_TEST_';

async function createTestWorkspace() {
  return prisma.workspace.create({
    data: {
      name:
        `${TEST_PREFIX}${randomUUID()}`,
      type: 'BUSINESS',
    },
  });
}

async function createCreditCardAccount(
  workspaceId: string,
  options: {
    name?: string;
    creditLimit?: number;
    closingDay?: number;
    dueDay?: number;
  } = {},
) {
  const account =
    await createAccount({
      workspaceId,
      name:
        options.name ??
        'Cartão teste',
      type: 'CREDIT_CARD',
      currency: 'BRL',
      initialBalance: 0,
    });

  const card =
    await createCreditCard({
      workspaceId,
      accountId:
        account.id,
      creditLimit:
        options.creditLimit ??
        1000,
      closingDay:
        options.closingDay ??
        10,
      dueDay:
        options.dueDay ??
        20,
    });

  return {
    account,
    card,
  };
}

async function createExpenseCategory(
  workspaceId: string,
) {
  return createCategory({
    workspaceId,
    name:
      `Despesa ${randomUUID()}`,
    type: 'EXPENSE',
  });
}

async function cleanupTestData() {
  const workspaces =
    await prisma.workspace.findMany({
      where: {
        name: {
          startsWith:
            TEST_PREFIX,
        },
      },
      select: {
        id: true,
      },
    });

  if (
    workspaces.length === 0
  ) {
    return;
  }

  const workspaceIds =
    workspaces.map(
      (workspace) =>
        workspace.id,
    );

  await prisma.financialTransaction.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.creditCardInvoice.deleteMany({
    where: {
      creditCard: {
        account: {
          workspaceId: {
            in: workspaceIds,
          },
        },
      },
    },
  });

  await prisma.creditCard.deleteMany({
    where: {
      account: {
        workspaceId: {
          in: workspaceIds,
        },
      },
    },
  });

  await prisma.category.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.account.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.workspace.deleteMany({
    where: {
      id: {
        in: workspaceIds,
      },
    },
  });
}

beforeAll(
  async () => {
    await cleanupTestData();
  },
);

afterEach(
  async () => {
    await cleanupTestData();
  },
);

afterAll(
  async () => {
    await cleanupTestData();

    await prisma.$disconnect();
  },
);

describe(
  'Credit card core',
  () => {
    test(
      'configures and retrieves a credit card for an active credit card account',
      async () => {
        const workspace =
          await createTestWorkspace();

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Cartão principal',
            type:
              'CREDIT_CARD',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        const card =
          await createCreditCard({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            creditLimit:
              5000,
            closingDay:
              10,
            dueDay:
              20,
          });

        expect(
          card.accountId,
        ).toBe(account.id);

        expect(
          card.creditLimit.toString(),
        ).toBe('5000');

        expect(
          card.closingDay,
        ).toBe(10);

        expect(
          card.dueDay,
        ).toBe(20);

        const retrieved =
          await getCreditCard(
            workspace.id,
            account.id,
          );

        expect(
          retrieved.id,
        ).toBe(card.id);

        expect(
          retrieved.account.id,
        ).toBe(account.id);
      },
    );

    test(
      'validates credit card configuration and prevents duplicate configuration',
      async () => {
        const workspace =
          await createTestWorkspace();

        const checkingAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta corrente',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        await expect(
          createCreditCard({
            workspaceId:
              workspace.id,
            accountId:
              checkingAccount.id,
            creditLimit:
              1000,
            closingDay:
              10,
            dueDay:
              20,
          }),
        ).rejects.toThrow(
          'Account must be a credit card account',
        );

        const cardAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Cartão validação',
            type:
              'CREDIT_CARD',
            currency:
              'BRL',
            initialBalance:
              0,
          });

        await expect(
          createCreditCard({
            workspaceId:
              workspace.id,
            accountId:
              cardAccount.id,
            creditLimit:
              0,
            closingDay:
              10,
            dueDay:
              20,
          }),
        ).rejects.toThrow(
          'Credit limit must be greater than zero',
        );

        await expect(
          createCreditCard({
            workspaceId:
              workspace.id,
            accountId:
              cardAccount.id,
            creditLimit:
              1000,
            closingDay:
              0,
            dueDay:
              20,
          }),
        ).rejects.toThrow(
          'Invalid closing day',
        );

        await expect(
          createCreditCard({
            workspaceId:
              workspace.id,
            accountId:
              cardAccount.id,
            creditLimit:
              1000,
            closingDay:
              10,
            dueDay:
              32,
          }),
        ).rejects.toThrow(
          'Invalid due day',
        );

        await createCreditCard({
          workspaceId:
            workspace.id,
          accountId:
            cardAccount.id,
          creditLimit:
            1000,
          closingDay:
            10,
          dueDay:
            20,
        });

        await expect(
          createCreditCard({
            workspaceId:
              workspace.id,
            accountId:
              cardAccount.id,
            creditLimit:
              2000,
            closingDay:
              15,
            dueDay:
              25,
          }),
        ).rejects.toThrow(
          'Credit card already configured for this account',
        );
      },
    );

    test(
      'creates a posted credit card purchase with debit ledger entry and open invoice',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account,
        } =
          await createCreditCardAccount(
            workspace.id,
          );

        const category =
          await createExpenseCategory(
            workspace.id,
          );

        const result =
          await createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            categoryId:
              category.id,
            amount:
              300,
            description:
              'Compra mercado',
            transactionDate:
              new Date(
                '2026-09-05T12:00:00.000Z',
              ),
          });

        expect(
          result.transaction.type,
        ).toBe('EXPENSE');

        expect(
          result.transaction.status,
        ).toBe('POSTED');

        expect(
          result.transaction.description,
        ).toBe(
          'Compra mercado',
        );

        expect(
          result.invoice.status,
        ).toBe('OPEN');

        expect(
          result.invoice.referenceMonth,
        ).toBe(9);

        expect(
          result.invoice.referenceYear,
        ).toBe(2026);

        expect(
          result.invoice.totalAmount.toString(),
        ).toBe('300');

        const entries =
          await prisma.ledgerEntry.findMany({
            where: {
              transactionId:
                result.transaction.id,
            },
          });

        expect(
          entries,
        ).toHaveLength(1);

        expect(
          entries[0]?.accountId,
        ).toBe(account.id);

        expect(
          entries[0]?.type,
        ).toBe('DEBIT');

        expect(
          entries[0]?.amount.toString(),
        ).toBe('300');
      },
    );

    test(
      'moves purchases after the closing day into the next invoice cycle',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account,
        } =
          await createCreditCardAccount(
            workspace.id,
            {
              closingDay: 10,
              dueDay: 20,
            },
          );

        const result =
          await createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            amount:
              200,
            description:
              'Compra após fechamento',
            transactionDate:
              new Date(
                '2026-09-15T12:00:00.000Z',
              ),
          });

        expect(
          result.invoice.referenceMonth,
        ).toBe(10);

        expect(
          result.invoice.referenceYear,
        ).toBe(2026);

        expect(
          result.invoice.totalAmount.toString(),
        ).toBe('200');
      },
    );

    test(
      'rejects purchases that would exceed the available credit limit',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account,
        } =
          await createCreditCardAccount(
            workspace.id,
            {
              creditLimit: 500,
            },
          );

        await createCreditCardPurchase({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          amount:
            400,
          description:
            'Primeira compra',
          transactionDate:
            new Date(
              '2026-09-05T12:00:00.000Z',
            ),
        });

        await expect(
          createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            amount:
              150,
            description:
              'Compra acima do limite',
            transactionDate:
              new Date(
                '2026-09-06T12:00:00.000Z',
              ),
          }),
        ).rejects.toThrow(
          'Insufficient credit limit',
        );

        const invoice =
          await prisma.creditCardInvoice.findFirstOrThrow({
            where: {
              creditCard: {
                accountId:
                  account.id,
              },
            },
          });

        expect(
          invoice.totalAmount.toString(),
        ).toBe('400');
      },
    );

    test(
      'updates purchase amount description and invoice total',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account,
        } =
          await createCreditCardAccount(
            workspace.id,
          );

        const purchase =
          await createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            amount:
              200,
            description:
              'Compra antiga',
            transactionDate:
              new Date(
                '2026-09-05T12:00:00.000Z',
              ),
          });

        const updated =
          await updateCreditCardPurchase({
            workspaceId:
              workspace.id,
            transactionId:
              purchase.transaction.id,
            amount:
              350,
            description:
              'Compra atualizada',
          });

        expect(
          updated?.description,
        ).toBe(
          'Compra atualizada',
        );

        expect(
          updated?.invoice
            ?.totalAmount
            .toString(),
        ).toBe('350');

        expect(
          updated?.entries,
        ).toHaveLength(1);

        expect(
          updated?.entries[0]
            ?.amount
            .toString(),
        ).toBe('350');
      },
    );

    test(
      'moves an edited purchase to another invoice cycle and adjusts both invoices',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account,
        } =
          await createCreditCardAccount(
            workspace.id,
            {
              closingDay: 10,
              dueDay: 20,
            },
          );

        const purchase =
          await createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            amount:
              200,
            description:
              'Compra original',
            transactionDate:
              new Date(
                '2026-09-05T12:00:00.000Z',
              ),
          });

        expect(
          purchase.invoice.referenceMonth,
        ).toBe(9);

        const updated =
          await updateCreditCardPurchase({
            workspaceId:
              workspace.id,
            transactionId:
              purchase.transaction.id,
            amount:
              300,
            transactionDate:
              new Date(
                '2026-09-15T12:00:00.000Z',
              ),
          });

        expect(
          updated?.invoice
            ?.referenceMonth,
        ).toBe(10);

        expect(
          updated?.invoice
            ?.referenceYear,
        ).toBe(2026);

        expect(
          updated?.invoice
            ?.totalAmount
            .toString(),
        ).toBe('300');

        const oldInvoice =
          await prisma.creditCardInvoice.findUniqueOrThrow({
            where: {
              id:
                purchase.invoice.id,
            },
          });

        expect(
          oldInvoice.totalAmount.toString(),
        ).toBe('0');
      },
    );

    test(
      'voids a purchase and subtracts its amount from the open invoice',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account,
        } =
          await createCreditCardAccount(
            workspace.id,
          );

        const purchase =
          await createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            amount:
              250,
            description:
              'Compra para anular',
            transactionDate:
              new Date(
                '2026-09-05T12:00:00.000Z',
              ),
          });

        const voided =
          await voidCreditCardPurchase({
            workspaceId:
              workspace.id,
            transactionId:
              purchase.transaction.id,
          });

        expect(
          voided.status,
        ).toBe('VOIDED');

        const invoice =
          await prisma.creditCardInvoice.findUniqueOrThrow({
            where: {
              id:
                purchase.invoice.id,
            },
          });

        expect(
          invoice.totalAmount.toString(),
        ).toBe('0');

        const entries =
          await prisma.ledgerEntry.findMany({
            where: {
              transactionId:
                purchase.transaction.id,
            },
          });

        expect(
          entries,
        ).toHaveLength(1);
      },
    );

    test(
      'pays an invoice using available balance and creates both transfer ledger entries',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account:
            creditCardAccount,
        } =
          await createCreditCardAccount(
            workspace.id,
            {
              creditLimit:
                2000,
            },
          );

        const paymentAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta pagamento',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        const purchase =
          await createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              creditCardAccount.id,
            amount:
              600,
            description:
              'Compra da fatura',
            transactionDate:
              new Date(
                '2026-09-05T12:00:00.000Z',
              ),
          });

        const result =
          await payCreditCardInvoice({
            workspaceId:
              workspace.id,
            invoiceId:
              purchase.invoice.id,
            paymentAccountId:
              paymentAccount.id,
            paymentDate:
              new Date(
                '2026-09-20T12:00:00.000Z',
              ),
          });

        expect(
          result.invoice.status,
        ).toBe('PAID');

        expect(
          result.paymentAmount.toString(),
        ).toBe('600');

        expect(
          result.transaction.type,
        ).toBe('TRANSFER');

        expect(
          result.transaction.status,
        ).toBe('POSTED');

        const entries =
          await prisma.ledgerEntry.findMany({
            where: {
              transactionId:
                result.transaction.id,
            },
            orderBy: {
              type: 'asc',
            },
          });

        expect(
          entries,
        ).toHaveLength(2);

        const debit =
          entries.find(
            (entry) =>
              entry.type ===
              'DEBIT',
          );

        const credit =
          entries.find(
            (entry) =>
              entry.type ===
              'CREDIT',
          );

        expect(
          debit?.accountId,
        ).toBe(
          paymentAccount.id,
        );

        expect(
          debit?.amount.toString(),
        ).toBe('600');

        expect(
          credit?.accountId,
        ).toBe(
          creditCardAccount.id,
        );

        expect(
          credit?.amount.toString(),
        ).toBe('600');
      },
    );

    test(
      'rejects invoice payment when the payment account has insufficient funds',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account:
            creditCardAccount,
        } =
          await createCreditCardAccount(
            workspace.id,
            {
              creditLimit:
                2000,
            },
          );

        const paymentAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta sem saldo',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              500,
          });

        const purchase =
          await createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              creditCardAccount.id,
            amount:
              600,
            description:
              'Compra sem saldo para pagar',
            transactionDate:
              new Date(
                '2026-09-05T12:00:00.000Z',
              ),
          });

        await expect(
          payCreditCardInvoice({
            workspaceId:
              workspace.id,
            invoiceId:
              purchase.invoice.id,
            paymentAccountId:
              paymentAccount.id,
            paymentDate:
              new Date(
                '2026-09-20T12:00:00.000Z',
              ),
          }),
        ).rejects.toThrow(
          'Insufficient funds',
        );

        const invoice =
          await prisma.creditCardInvoice.findUniqueOrThrow({
            where: {
              id:
                purchase.invoice.id,
            },
          });

        expect(
          invoice.status,
        ).toBe('OPEN');
      },
    );

    test(
      'rejects paying the same invoice twice',
      async () => {
        const workspace =
          await createTestWorkspace();

        const {
          account:
            creditCardAccount,
        } =
          await createCreditCardAccount(
            workspace.id,
            {
              creditLimit:
                2000,
            },
          );

        const paymentAccount =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta pagamento duplicado',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              2000,
          });

        const purchase =
          await createCreditCardPurchase({
            workspaceId:
              workspace.id,
            accountId:
              creditCardAccount.id,
            amount:
              500,
            description:
              'Compra pagamento único',
            transactionDate:
              new Date(
                '2026-09-05T12:00:00.000Z',
              ),
          });

        await payCreditCardInvoice({
          workspaceId:
            workspace.id,
          invoiceId:
            purchase.invoice.id,
          paymentAccountId:
            paymentAccount.id,
          paymentDate:
            new Date(
              '2026-09-20T12:00:00.000Z',
            ),
        });

        await expect(
          payCreditCardInvoice({
            workspaceId:
              workspace.id,
            invoiceId:
              purchase.invoice.id,
            paymentAccountId:
              paymentAccount.id,
            paymentDate:
              new Date(
                '2026-09-21T12:00:00.000Z',
              ),
          }),
        ).rejects.toThrow(
          'Invoice is already paid',
        );
      },
    );
  },
);