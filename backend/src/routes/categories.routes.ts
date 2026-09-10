import type { FastifyInstance } from 'fastify';

import type {
  TransactionType,
} from '../generated/prisma/client.js';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/category.service.js';

function isCategoryType(
  value: string,
): value is TransactionType {
  return (
    value === 'INCOME' ||
    value === 'EXPENSE'
  );
}

export async function categoriesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/categories',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        requireWorkspaceRoles(
          'OWNER',
          'ADMIN',
          'FINANCE',
        ),
      ],
    },
    async (request, reply) => {
      const { name, type } =
        request.body as {
          name?: string;
          type?: string;
        };

      if (!name || !type) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Name and type are required',
        });
      }

      const normalizedName =
        name.trim();

      if (
        normalizedName.length < 2
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Category name must contain at least 2 characters',
        });
      }

      if (!isCategoryType(type)) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid category type',
        });
      }

      const category =
        await createCategory({
          workspaceId:
            request.workspace.id,
          name: normalizedName,
          type,
        });

      return reply.status(201).send({
        status: 'success',
        category,
      });
    },
  );

  app.get(
    '/categories',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const { type } =
        request.query as {
          type?: string;
        };

      let normalizedType:
        | TransactionType
        | undefined;

      if (type !== undefined) {
        if (
          !isCategoryType(type)
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Invalid category type',
            });
        }

        normalizedType = type;
      }

      const categories =
        await listCategories(
          request.workspace.id,
          normalizedType,
        );

      return reply.status(200).send({
        status: 'success',
        categories,
      });
    },
  );

  app.patch(
    '/categories/:categoryId',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        requireWorkspaceRoles(
          'OWNER',
          'ADMIN',
          'FINANCE',
        ),
      ],
    },
    async (request, reply) => {
      const { categoryId } =
        request.params as {
          categoryId: string;
        };

      const { name, type } =
        request.body as {
          name?: string;
          type?: string;
        };

      if (
        name === undefined &&
        type === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'At least one category field must be provided',
        });
      }

      let normalizedName:
        | string
        | undefined;

      if (name !== undefined) {
        normalizedName =
          name.trim();

        if (
          normalizedName.length < 2
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Category name must contain at least 2 characters',
            });
        }
      }

      let normalizedType:
        | TransactionType
        | undefined;

      if (type !== undefined) {
        if (
          !isCategoryType(type)
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Invalid category type',
            });
        }

        normalizedType = type;
      }

      const category =
        await updateCategory({
          workspaceId:
            request.workspace.id,
          categoryId,
          ...(normalizedName !==
          undefined
            ? {
                name:
                  normalizedName,
              }
            : {}),
          ...(normalizedType !==
          undefined
            ? {
                type:
                  normalizedType,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        category,
      });
    },
  );

  app.delete(
    '/categories/:categoryId',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        requireWorkspaceRoles(
          'OWNER',
          'ADMIN',
          'FINANCE',
        ),
      ],
    },
    async (request, reply) => {
      const { categoryId } =
        request.params as {
          categoryId: string;
        };

      const category =
        await deleteCategory({
          workspaceId:
            request.workspace.id,
          categoryId,
        });

      return reply.status(200).send({
        status: 'success',
        deletedCategory:
          category,
      });
    },
  );
}