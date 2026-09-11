import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'vitest';

import { prisma } from '../lib/prisma.js';

import {
  createCreditCardInstallmentPurchase,
  updateCreditCardInstallmentPurchase,
  voidCreditCardInstallmentPurchase,
} from '../services/credit-card-installment.service.js';

import {
  refundCreditCardInstallmentPurchase,
} from '../services/credit-card-installment-refund.service.js';

import {
  closeCreditCardInvoice,
} from '../services/credit-card-invoice.service.js';

import {
  getCreditCardLimit,
} from '../services/credit-card-limit.service.js';

const TEST_PREFIX =
  'FINPILOT_VITEST_';

async function createFixture() {
  const workspace =
    await prisma.workspace.create({
      data: {
        name:
          `${TEST_PREFIX}${crypto.randomUUID()}`,
        type: 'PERSONAL',
      },
    });

  const account =
    await prisma.account.create({
      data: {
        workspaceId:
          workspace.id,
        name:
          'Cartão Teste Vitest',
        type: 'CREDIT_CARD',
        status: 'ACTIVE',
        currency: 'BRL',
        initialBalance: 0,
      },
    });

  const creditCard =
    await prisma.creditCard.create({
      data: {
        accountId:
          account.id,
        creditLimit: 5000,
        closingDay: 10,
        dueDay: 17,
      },
    });

  return {
    workspace,
    account,
    creditCard,
  };
}

async function cleanupTestWorkspaces() {
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

  /*
   * Precisamos remover primeiro os
   * registros que possuem relações
   * RESTRICT com Account e Category.
   *
   * Ao apagar FinancialTransaction,
   * os LedgerEntry são removidos por
   * cascade.
   */
  await prisma.financialTransaction.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.recurringTransaction.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.budget.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.creditCardInstallmentPurchase.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  /*
   * Agora o Workspace pode ser
   * removido normalmente e os demais
   * registros são eliminados pelos
   * cascades definidos no Prisma.
   */
  await prisma.workspace.deleteMany({
    where: {
      id: {
        in: workspaceIds,
      },
    },
  });
}

beforeAll(async () => {
  /*
   * Remove qualquer fixture que tenha
   * sobrado de uma execução interrompida
   * ou da versão anterior do cleanup.
   */
  await cleanupTestWorkspaces();
});

afterEach(async () => {
  await cleanupTestWorkspaces();
});

afterAll(async () => {
  await cleanupTestWorkspaces();
  await prisma.$disconnect();
});

describe(
  'Credit card installment purchases',
  () => {
    test(
      'creates a 3-installment purchase and consumes the full amount from the limit',
      async () => {
        const {
          workspace,
          account,
        } =
          await createFixture();

        const purchase =
          await createCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            totalAmount: 1000,
            description:
              'Notebook teste',
            installmentCount: 3,
            purchaseDate:
              new Date(
                '2030-01-05T12:00:00.000Z',
              ),
          });

        expect(
          purchase.status,
        ).toBe('ACTIVE');

        expect(
          purchase.transactions,
        ).toHaveLength(3);

        const amounts =
          purchase.transactions.map(
            (transaction) =>
              transaction.entries[0]
                ?.amount.toString(),
          );

        expect(amounts).toEqual([
          '333.34',
          '333.33',
          '333.33',
        ]);

        const limit =
          await getCreditCardLimit(
            workspace.id,
            account.id,
          );

        expect(
          limit.creditLimit.toString(),
        ).toBe('5000');

        expect(
          limit.usedLimit.toString(),
        ).toBe('1000');

        expect(
          limit.availableLimit.toString(),
        ).toBe('4000');
      },
    );

    test(
      'edits a purchase from 3 to 4 installments and redistributes the amount',
      async () => {
        const {
          workspace,
          account,
        } =
          await createFixture();

        const purchase =
          await createCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            totalAmount: 1000,
            description:
              'Compra original',
            installmentCount: 3,
            purchaseDate:
              new Date(
                '2031-01-05T12:00:00.000Z',
              ),
          });

        const updated =
          await updateCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            installmentPurchaseId:
              purchase.id,
            totalAmount: 1200,
            installmentCount: 4,
            description:
              'Compra editada',
          });

        expect(
          updated.id,
        ).toBe(
          purchase.id,
        );

        expect(
          updated.description,
        ).toBe(
          'Compra editada',
        );

        expect(
          updated.totalAmount.toString(),
        ).toBe('1200');

        expect(
          updated.installmentCount,
        ).toBe(4);

        expect(
          updated.transactions,
        ).toHaveLength(4);

        for (
          const transaction of
            updated.transactions
        ) {
          expect(
            transaction.entries[0]
              ?.amount.toString(),
          ).toBe('300');
        }

        const limit =
          await getCreditCardLimit(
            workspace.id,
            account.id,
          );

        expect(
          limit.usedLimit.toString(),
        ).toBe('1200');

        expect(
          limit.availableLimit.toString(),
        ).toBe('3800');
      },
    );

    test(
      'voids an installment purchase and restores the credit limit',
      async () => {
        const {
          workspace,
          account,
        } =
          await createFixture();

        const purchase =
          await createCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            totalAmount: 900,
            description:
              'Compra para void',
            installmentCount: 3,
            purchaseDate:
              new Date(
                '2032-01-05T12:00:00.000Z',
              ),
          });

        const before =
          await getCreditCardLimit(
            workspace.id,
            account.id,
          );

        expect(
          before.usedLimit.toString(),
        ).toBe('900');

        const voided =
          await voidCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            installmentPurchaseId:
              purchase.id,
          });

        expect(
          voided.status,
        ).toBe('VOIDED');

        expect(
          voided.transactions.every(
            (transaction) =>
              transaction.status ===
              'VOIDED',
          ),
        ).toBe(true);

        const after =
          await getCreditCardLimit(
            workspace.id,
            account.id,
          );

        expect(
          after.usedLimit.toString(),
        ).toBe('0');

        expect(
          after.availableLimit.toString(),
        ).toBe('5000');
      },
    );

    test(
      'refunds a purchase with one closed invoice while preserving history',
      async () => {
        const {
          workspace,
          account,
        } =
          await createFixture();

        const purchase =
          await createCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            totalAmount: 900,
            description:
              'Compra para refund',
            installmentCount: 3,
            purchaseDate:
              new Date(
                '2033-01-05T12:00:00.000Z',
              ),
          });

        const firstInstallment =
          purchase.transactions.find(
            (transaction) =>
              transaction.installmentNumber ===
              1,
          );

        expect(
          firstInstallment,
        ).toBeDefined();

        expect(
          firstInstallment
            ?.invoiceId,
        ).toBeTruthy();

        await closeCreditCardInvoice({
          workspaceId:
            workspace.id,
          invoiceId:
            firstInstallment!
              .invoiceId!,
        });

        const result =
          await refundCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            installmentPurchaseId:
              purchase.id,
            refundDate:
              new Date(
                '2033-01-20T12:00:00.000Z',
              ),
          });

        expect(
          result
            .installmentPurchase
            .status,
        ).toBe('REFUNDED');

        expect(
          result
            .refundAmount
            .toString(),
        ).toBe('300');

        expect(
          result
            .cancelledOpenInstallments,
        ).toBe(2);

        const installments =
          result
            .installmentPurchase
            .transactions;

        expect(
          installments[0]
            ?.status,
        ).toBe('POSTED');

        expect(
          installments[0]
            ?.invoice
            ?.status,
        ).toBe('CLOSED');

        expect(
          installments[1]
            ?.status,
        ).toBe('VOIDED');

        expect(
          installments[2]
            ?.status,
        ).toBe('VOIDED');

        expect(
          installments[1]
            ?.invoice
            ?.totalAmount
            .toString(),
        ).toBe('0');

        expect(
          installments[2]
            ?.invoice
            ?.totalAmount
            .toString(),
        ).toBe('0');

        expect(
          result
            .installmentPurchase
            .refundTransaction
            ?.type,
        ).toBe('REFUND');

        expect(
          result
            .installmentPurchase
            .refundTransaction
            ?.entries[0]
            ?.type,
        ).toBe('CREDIT');

        expect(
          result
            .installmentPurchase
            .refundTransaction
            ?.entries[0]
            ?.amount
            .toString(),
        ).toBe('300');

        const limit =
          await getCreditCardLimit(
            workspace.id,
            account.id,
          );

        expect(
          limit.usedLimit.toString(),
        ).toBe('0');

        expect(
          limit.availableLimit.toString(),
        ).toBe('5000');
      },
    );

    test(
      'rejects a duplicate installment refund',
      async () => {
        const {
          workspace,
          account,
        } =
          await createFixture();

        const purchase =
          await createCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            totalAmount: 600,
            description:
              'Refund duplicado',
            installmentCount: 2,
            purchaseDate:
              new Date(
                '2034-01-05T12:00:00.000Z',
              ),
          });

        const firstInstallment =
          purchase.transactions.find(
            (transaction) =>
              transaction.installmentNumber ===
              1,
          );

        expect(
          firstInstallment
            ?.invoiceId,
        ).toBeTruthy();

        await closeCreditCardInvoice({
          workspaceId:
            workspace.id,
          invoiceId:
            firstInstallment!
              .invoiceId!,
        });

        await refundCreditCardInstallmentPurchase({
          workspaceId:
            workspace.id,
          installmentPurchaseId:
            purchase.id,
          refundDate:
            new Date(
              '2034-01-20T12:00:00.000Z',
            ),
        });

        await expect(
          refundCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            installmentPurchaseId:
              purchase.id,
            refundDate:
              new Date(
                '2034-01-21T12:00:00.000Z',
              ),
          }),
        ).rejects.toThrow(
          'Installment purchase is already refunded',
        );

        const refunds =
          await prisma.financialTransaction.count({
            where: {
              workspaceId:
                workspace.id,
              type: 'REFUND',
            },
          });

        expect(
          refunds,
        ).toBe(1);

        const limit =
          await getCreditCardLimit(
            workspace.id,
            account.id,
          );

        expect(
          limit.usedLimit.toString(),
        ).toBe('0');
      },
    );

    test(
      'rolls back an edit that exceeds the credit limit',
      async () => {
        const {
          workspace,
          account,
        } =
          await createFixture();

        const purchase =
          await createCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            accountId:
              account.id,
            totalAmount: 1000,
            description:
              'Rollback teste',
            installmentCount: 4,
            purchaseDate:
              new Date(
                '2035-01-05T12:00:00.000Z',
              ),
          });

        await expect(
          updateCreditCardInstallmentPurchase({
            workspaceId:
              workspace.id,
            installmentPurchaseId:
              purchase.id,
            totalAmount: 6000,
          }),
        ).rejects.toThrow(
          'Insufficient credit card limit',
        );

        const persisted =
          await prisma
            .creditCardInstallmentPurchase
            .findUnique({
              where: {
                id:
                  purchase.id,
              },
              include: {
                transactions: {
                  include: {
                    entries: true,
                  },
                  orderBy: {
                    installmentNumber:
                      'asc',
                  },
                },
              },
            });

        expect(
          persisted,
        ).not.toBeNull();

        expect(
          persisted
            ?.totalAmount
            .toString(),
        ).toBe('1000');

        expect(
          persisted
            ?.installmentCount,
        ).toBe(4);

        expect(
          persisted
            ?.transactions,
        ).toHaveLength(4);

        const total =
          persisted!.transactions.reduce(
            (
              sum,
              transaction,
            ) =>
              sum +
              Number(
                transaction
                  .entries[0]
                  ?.amount ??
                  0,
              ),
            0,
          );

        expect(
          total,
        ).toBe(1000);

        const limit =
          await getCreditCardLimit(
            workspace.id,
            account.id,
          );

        expect(
          limit.usedLimit.toString(),
        ).toBe('1000');

        expect(
          limit.availableLimit.toString(),
        ).toBe('4000');
      },
    );
  },
);