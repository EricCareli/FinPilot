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
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/category.service.js';

import {
  createTransaction,
} from '../services/transaction.service.js';

const TEST_PREFIX =
  'FINPILOT_CATEGORY_TEST_';

async function createTestWorkspace() {
  return prisma.workspace.create({
    data: {
      name:
        `${TEST_PREFIX}${randomUUID()}`,
      type: 'BUSINESS',
    },
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
  'Categories',
  () => {
    test(
      'creates categories and filters them by type',
      async () => {
        const workspace =
          await createTestWorkspace();

        const salary =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Salário',
            type:
              'INCOME',
          });

        const food =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Alimentação',
            type:
              'EXPENSE',
          });

        const expenseSalary =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Salário',
            type:
              'EXPENSE',
          });

        expect(
          salary.name,
        ).toBe('Salário');

        expect(
          salary.type,
        ).toBe('INCOME');

        expect(
          food.type,
        ).toBe('EXPENSE');

        expect(
          expenseSalary.type,
        ).toBe('EXPENSE');

        const allCategories =
          await listCategories(
            workspace.id,
          );

        expect(
          allCategories,
        ).toHaveLength(3);

        const incomeCategories =
          await listCategories(
            workspace.id,
            'INCOME',
          );

        expect(
          incomeCategories,
        ).toHaveLength(1);

        expect(
          incomeCategories[0]?.id,
        ).toBe(salary.id);

        const expenseCategories =
          await listCategories(
            workspace.id,
            'EXPENSE',
          );

        expect(
          expenseCategories,
        ).toHaveLength(2);

        expect(
          expenseCategories.map(
            (category) =>
              category.name,
          ),
        ).toEqual([
          'Alimentação',
          'Salário',
        ]);
      },
    );

    test(
      'rejects a duplicate category with the same name and type',
      async () => {
        const workspace =
          await createTestWorkspace();

        await createCategory({
          workspaceId:
            workspace.id,
          name:
            'Alimentação',
          type:
            'EXPENSE',
        });

        await expect(
          createCategory({
            workspaceId:
              workspace.id,
            name:
              'Alimentação',
            type:
              'EXPENSE',
          }),
        ).rejects.toThrow(
          'Category already exists',
        );

        const categories =
          await listCategories(
            workspace.id,
          );

        expect(
          categories,
        ).toHaveLength(1);
      },
    );

    test(
      'allows the same category name when the type is different',
      async () => {
        const workspace =
          await createTestWorkspace();

        const income =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Outros',
            type:
              'INCOME',
          });

        const expense =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Outros',
            type:
              'EXPENSE',
          });

        expect(
          income.name,
        ).toBe('Outros');

        expect(
          expense.name,
        ).toBe('Outros');

        expect(
          income.type,
        ).toBe('INCOME');

        expect(
          expense.type,
        ).toBe('EXPENSE');

        expect(
          income.id,
        ).not.toBe(
          expense.id,
        );
      },
    );

    test(
      'rejects category types other than income and expense',
      async () => {
        const workspace =
          await createTestWorkspace();

        await expect(
          createCategory({
            workspaceId:
              workspace.id,
            name:
              'Categoria inválida',
            type:
              'TRANSFER',
          }),
        ).rejects.toThrow(
          'Invalid category type',
        );

        const categories =
          await listCategories(
            workspace.id,
          );

        expect(
          categories,
        ).toHaveLength(0);
      },
    );

    test(
      'updates the name and type of an unused category',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Categoria antiga',
            type:
              'EXPENSE',
          });

        const updated =
          await updateCategory({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            name:
              'Categoria nova',
            type:
              'INCOME',
          });

        expect(
          updated.id,
        ).toBe(category.id);

        expect(
          updated.name,
        ).toBe(
          'Categoria nova',
        );

        expect(
          updated.type,
        ).toBe('INCOME');

        const persisted =
          await prisma.category.findUniqueOrThrow({
            where: {
              id:
                category.id,
            },
          });

        expect(
          persisted.name,
        ).toBe(
          'Categoria nova',
        );

        expect(
          persisted.type,
        ).toBe('INCOME');
      },
    );

    test(
      'rejects category type change after financial activity but still allows renaming',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Mercado',
            type:
              'EXPENSE',
          });

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta teste',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              1000,
          });

        await createTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            category.id,
          type:
            'EXPENSE',
          amount:
            100,
          description:
            'Compra mercado',
          transactionDate:
            new Date(
              '2026-09-10T12:00:00.000Z',
            ),
        });

        const renamed =
          await updateCategory({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            name:
              'Supermercado',
          });

        expect(
          renamed.name,
        ).toBe(
          'Supermercado',
        );

        expect(
          renamed.type,
        ).toBe('EXPENSE');

        await expect(
          updateCategory({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
            type:
              'INCOME',
          }),
        ).rejects.toThrow(
          'Category type cannot be changed after financial activity',
        );

        const persisted =
          await prisma.category.findUniqueOrThrow({
            where: {
              id:
                category.id,
            },
          });

        expect(
          persisted.name,
        ).toBe(
          'Supermercado',
        );

        expect(
          persisted.type,
        ).toBe('EXPENSE');
      },
    );

    test(
      'rejects an update that would create a duplicate category',
      async () => {
        const workspace =
          await createTestWorkspace();

        const food =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Alimentação',
            type:
              'EXPENSE',
          });

        const transport =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Transporte',
            type:
              'EXPENSE',
          });

        await expect(
          updateCategory({
            workspaceId:
              workspace.id,
            categoryId:
              transport.id,
            name:
              'Alimentação',
          }),
        ).rejects.toThrow(
          'Category already exists',
        );

        const persistedFood =
          await prisma.category.findUniqueOrThrow({
            where: {
              id:
                food.id,
            },
          });

        const persistedTransport =
          await prisma.category.findUniqueOrThrow({
            where: {
              id:
                transport.id,
            },
          });

        expect(
          persistedFood.name,
        ).toBe(
          'Alimentação',
        );

        expect(
          persistedTransport.name,
        ).toBe(
          'Transporte',
        );
      },
    );

    test(
      'deletes an unused category',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Categoria removível',
            type:
              'EXPENSE',
          });

        const deleted =
          await deleteCategory({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
          });

        expect(
          deleted.id,
        ).toBe(category.id);

        const persisted =
          await prisma.category.findUnique({
            where: {
              id:
                category.id,
            },
          });

        expect(
          persisted,
        ).toBeNull();
      },
    );

    test(
      'rejects deleting a category that is already in use',
      async () => {
        const workspace =
          await createTestWorkspace();

        const category =
          await createCategory({
            workspaceId:
              workspace.id,
            name:
              'Compras',
            type:
              'EXPENSE',
          });

        const account =
          await createAccount({
            workspaceId:
              workspace.id,
            name:
              'Conta compras',
            type:
              'CHECKING',
            currency:
              'BRL',
            initialBalance:
              500,
          });

        await createTransaction({
          workspaceId:
            workspace.id,
          accountId:
            account.id,
          categoryId:
            category.id,
          type:
            'EXPENSE',
          amount:
            50,
          description:
            'Compra teste',
          transactionDate:
            new Date(
              '2026-09-10T13:00:00.000Z',
            ),
        });

        await expect(
          deleteCategory({
            workspaceId:
              workspace.id,
            categoryId:
              category.id,
          }),
        ).rejects.toThrow(
          'Category cannot be deleted because it is already in use',
        );

        const persisted =
          await prisma.category.findUnique({
            where: {
              id:
                category.id,
            },
          });

        expect(
          persisted,
        ).not.toBeNull();
      },
    );
  },
);