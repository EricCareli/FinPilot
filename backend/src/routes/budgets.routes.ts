import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';
import {
  createBudget,
  listBudgets,
  getBudgetProgress,
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
        requireWorkspaceRoles('OWNER', 'ADMIN', 'FINANCE'),
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

      try {
        const budget = await createBudget({
          workspaceId: request.workspace.id,
          categoryId,
          amount,
          month,
          year,
        });

        return reply.status(201).send({
          status: 'success',
          budget,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (
            error.message === 'Category not found' ||
            error.message ===
              'Budget category must be an expense category' ||
            error.message ===
              'Budget amount must be greater than zero' ||
            error.message === 'Invalid month' ||
            error.message === 'Invalid year'
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message: error.message,
          });
        }

        throw error;
      }
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
        month !== undefined ? Number(month) : undefined;

      const parsedYear =
        year !== undefined ? Number(year) : undefined;

      if (
        parsedMonth !== undefined &&
        (!Number.isInteger(parsedMonth) ||
          parsedMonth < 1 ||
          parsedMonth > 12)
      ) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid month',
        });
      }

      if (
        parsedYear !== undefined &&
        (!Number.isInteger(parsedYear) ||
          parsedYear < 2000)
      ) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid year',
        });
      }

      const budgets = await listBudgets(
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

  app.get(
    '/budgets/:budgetId/progress',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const { budgetId } = request.params as {
        budgetId: string;
      };

      try {
        const progress = await getBudgetProgress(
          request.workspace.id,
          budgetId,
        );

        return reply.status(200).send({
          status: 'success',
          progress,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Budget not found'
        ) {
          return reply.status(404).send({
            status: 'error',
            message: 'Budget not found',
          });
        }

        throw error;
      }
    },
  );
}