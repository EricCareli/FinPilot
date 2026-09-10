import type {
  TransactionType,
} from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface CreateCategoryInput {
  workspaceId: string;
  name: string;
  type: TransactionType;
}

export interface UpdateCategoryInput {
  workspaceId: string;
  categoryId: string;
  name?: string;
  type?: TransactionType;
}

export interface DeleteCategoryInput {
  workspaceId: string;
  categoryId: string;
}

function validateCategoryType(
  type: TransactionType,
) {
  if (
    type !== 'INCOME' &&
    type !== 'EXPENSE'
  ) {
    throw new AppError(
      'Invalid category type',
      400,
    );
  }
}

export async function createCategory(
  input: CreateCategoryInput,
) {
  const name = input.name.trim();

  if (name.length < 2) {
    throw new AppError(
      'Category name must contain at least 2 characters',
      400,
    );
  }

  validateCategoryType(input.type);

  const existingCategory =
    await prisma.category.findFirst({
      where: {
        workspaceId: input.workspaceId,
        name,
        type: input.type,
      },
    });

  if (existingCategory) {
    throw new AppError(
      'Category already exists',
      409,
    );
  }

  return prisma.category.create({
    data: {
      workspaceId: input.workspaceId,
      name,
      type: input.type,
    },
  });
}

export async function listCategories(
  workspaceId: string,
  type?: TransactionType,
) {
  if (type !== undefined) {
    validateCategoryType(type);
  }

  return prisma.category.findMany({
    where: {
      workspaceId,
      ...(type !== undefined
        ? { type }
        : {}),
    },
    orderBy: [
      {
        type: 'asc',
      },
      {
        name: 'asc',
      },
    ],
  });
}

export async function updateCategory(
  input: UpdateCategoryInput,
) {
  if (
    input.name === undefined &&
    input.type === undefined
  ) {
    throw new AppError(
      'At least one category field must be provided',
      400,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const category =
        await tx.category.findFirst({
          where: {
            id: input.categoryId,
            workspaceId:
              input.workspaceId,
          },
        });

      if (!category) {
        throw new AppError(
          'Category not found',
          404,
        );
      }

      let nextName =
        category.name;

      if (input.name !== undefined) {
        nextName =
          input.name.trim();

        if (nextName.length < 2) {
          throw new AppError(
            'Category name must contain at least 2 characters',
            400,
          );
        }
      }

      const nextType =
        input.type ?? category.type;

      validateCategoryType(
        nextType,
      );

      if (
        nextType !== category.type
      ) {
        const [
          transactionCount,
          budgetCount,
          recurringCount,
        ] = await Promise.all([
          tx.financialTransaction.count({
            where: {
              categoryId:
                category.id,
            },
          }),
          tx.budget.count({
            where: {
              categoryId:
                category.id,
            },
          }),
          tx.recurringTransaction.count({
            where: {
              categoryId:
                category.id,
            },
          }),
        ]);

        if (
          transactionCount > 0 ||
          budgetCount > 0 ||
          recurringCount > 0
        ) {
          throw new AppError(
            'Category type cannot be changed after financial activity',
            400,
          );
        }
      }

      const duplicateCategory =
        await tx.category.findFirst({
          where: {
            workspaceId:
              input.workspaceId,
            name: nextName,
            type: nextType,
            id: {
              not: category.id,
            },
          },
        });

      if (duplicateCategory) {
        throw new AppError(
          'Category already exists',
          409,
        );
      }

      return tx.category.update({
        where: {
          id: category.id,
        },
        data: {
          name: nextName,
          type: nextType,
        },
      });
    },
  );
}

export async function deleteCategory(
  input: DeleteCategoryInput,
) {
  return prisma.$transaction(
    async (tx) => {
      const category =
        await tx.category.findFirst({
          where: {
            id: input.categoryId,
            workspaceId:
              input.workspaceId,
          },
        });

      if (!category) {
        throw new AppError(
          'Category not found',
          404,
        );
      }

      const [
        transactionCount,
        budgetCount,
        recurringCount,
      ] = await Promise.all([
        tx.financialTransaction.count({
          where: {
            categoryId: category.id,
          },
        }),
        tx.budget.count({
          where: {
            categoryId: category.id,
          },
        }),
        tx.recurringTransaction.count({
          where: {
            categoryId: category.id,
          },
        }),
      ]);

      if (
        transactionCount > 0 ||
        budgetCount > 0 ||
        recurringCount > 0
      ) {
        throw new AppError(
          'Category cannot be deleted because it is already in use',
          400,
        );
      }

      await tx.category.delete({
        where: {
          id: category.id,
        },
      });

      return category;
    },
  );
}