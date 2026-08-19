import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';
import {
  createCategory,
  listCategories,
} from '../services/category.service.js';

export async function categoriesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/categories',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        requireWorkspaceRoles('OWNER', 'ADMIN', 'FINANCE'),
      ],
    },
    async (request, reply) => {
      const { name, type } = request.body as {
        name?: string;
        type?: 'INCOME' | 'EXPENSE';
      };

      if (!name || !type) {
        return reply.status(400).send({
          status: 'error',
          message: 'Name and type are required',
        });
      }

      const normalizedName = name.trim();

      if (normalizedName.length < 2) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Category name must contain at least 2 characters',
        });
      }

      if (!['INCOME', 'EXPENSE'].includes(type)) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid category type',
        });
      }

      try {
        const category = await createCategory({
          workspaceId: request.workspace.id,
          name: normalizedName,
          type,
        });

        return reply.status(201).send({
          status: 'success',
          category,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Unique constraint')
        ) {
          return reply.status(409).send({
            status: 'error',
            message: 'Category already exists',
          });
        }

        throw error;
      }
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
      const categories = await listCategories(
        request.workspace.id,
      );

      return reply.status(200).send({
        status: 'success',
        categories,
      });
    },
  );
}