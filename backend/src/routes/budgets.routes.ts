import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  createBudget,
  deleteBudget,
  getBudgetProgress,
  listBudgets,
  updateBudget,
} from '../services/budget.service.js';

export async function budgetsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/budgets',
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
      const {
        categoryId,
        amount,
        month,
        year,
      } = request.body as {
        categoryId?: string;
        amount?: number;
        month?: number;
        year?: number;
      };

      if (
        !categoryId ||
        amount === undefined ||
        month === undefined ||
        year === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Category, amount, month and year are required',
        });
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Budget amount must be greater than zero',
        });
      }

      if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Month must be an integer between 1 and 12',
        });
      }

      if (
        !Number.isInteger(year) ||
        year < 2000
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Year must be a valid integer greater than or equal to 2000',
        });
      }

      const budget =
        await createBudget({
          workspaceId:
            request.workspace.id,
          categoryId,
          amount,
          month,
          year,
        });

      return reply.status(201).send({
        status: 'success',
        budget,
      });
    },
  );

  app.get(
    '/budgets',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const {
        month,
        year,
      } = request.query as {
        month?: string;
        year?: string;
      };

      const parsedMonth =
        month !== undefined
          ? Number(month)
          : undefined;

      const parsedYear =
        year !== undefined
          ? Number(year)
          : undefined;

      if (
        parsedMonth !== undefined &&
        (!Number.isInteger(
          parsedMonth,
        ) ||
          parsedMonth < 1 ||
          parsedMonth > 12)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Month must be an integer between 1 and 12',
        });
      }

      if (
        parsedYear !== undefined &&
        (!Number.isInteger(
          parsedYear,
        ) ||
          parsedYear < 2000)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Year must be a valid integer greater than or equal to 2000',
        });
      }

      if (
        (parsedMonth !== undefined &&
          parsedYear === undefined) ||
        (parsedMonth === undefined &&
          parsedYear !== undefined)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Month and year must be provided together',
        });
      }

      const budgets =
        await listBudgets(
          request.workspace.id,
          parsedMonth,
          parsedYear,
        );

      return reply.status(200).send({
        status: 'success',
        budgets,
      });
    },
  );

  app.patch(
    '/budgets/:budgetId',
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
      const { budgetId } =
        request.params as {
          budgetId: string;
        };

      const {
        categoryId,
        amount,
        month,
        year,
      } = request.body as {
        categoryId?: string;
        amount?: number;
        month?: number;
        year?: number;
      };

      if (
        categoryId === undefined &&
        amount === undefined &&
        month === undefined &&
        year === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'At least one budget field must be provided',
        });
      }

      if (
        categoryId !== undefined &&
        !categoryId.trim()
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Category is required',
        });
      }

      if (
        amount !== undefined &&
        (!Number.isFinite(amount) ||
          amount <= 0)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Budget amount must be greater than zero',
        });
      }

      if (
        month !== undefined &&
        (!Number.isInteger(month) ||
          month < 1 ||
          month > 12)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Month must be an integer between 1 and 12',
        });
      }

      if (
        year !== undefined &&
        (!Number.isInteger(year) ||
          year < 2000)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Year must be a valid integer greater than or equal to 2000',
        });
      }

      const budget =
        await updateBudget({
          workspaceId:
            request.workspace.id,
          budgetId,
          ...(categoryId !== undefined
            ? {
                categoryId,
              }
            : {}),
          ...(amount !== undefined
            ? {
                amount,
              }
            : {}),
          ...(month !== undefined
            ? {
                month,
              }
            : {}),
          ...(year !== undefined
            ? {
                year,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        budget,
      });
    },
  );

  app.delete(
    '/budgets/:budgetId',
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
      const { budgetId } =
        request.params as {
          budgetId: string;
        };

      const budget =
        await deleteBudget({
          workspaceId:
            request.workspace.id,
          budgetId,
        });

      return reply.status(200).send({
        status: 'success',
        deletedBudget: budget,
      });
    },
  );

  app.get(
    '/budgets/:budgetId/progress',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const { budgetId } =
        request.params as {
          budgetId: string;
        };

      const progress =
        await getBudgetProgress(
          request.workspace.id,
          budgetId,
        );

      return reply.status(200).send({
        status: 'success',
        progress,
      });
    },
  );
}