import { prisma } from '../lib/prisma.js';
import type { TransactionType } from '../generated/prisma/client.js';

export interface CreateCategoryInput {
  workspaceId: string;
  name: string;
  type: TransactionType;
}

export async function createCategory(
  input: CreateCategoryInput,
) {
  return prisma.category.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      type: input.type,
    },
  });
}

export async function listCategories(
  workspaceId: string,
) {
  return prisma.category.findMany({
    where: {
      workspaceId,
    },
    orderBy: {
      name: 'asc',
    },
  });
}