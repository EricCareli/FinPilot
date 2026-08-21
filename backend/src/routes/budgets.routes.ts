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
            error.message ===
              'Category not found' ||
            error.message ===
              'Budget category must be an expense category' ||
            error.message ===
              'Budget amount must be greater than zero' ||
            error.message ===
              'Month must be an integer between 1 and 12' ||
            error.message ===
              'Year must be a valid integer greater than or equal to 2000' ||
            error.message ===
              'Budget already exists for this category and period'
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
        month !== undefined
          ? Number(month)
          : undefined;

      const parsedYear =
        year !== undefined
          ? Number(year)
          : undefined;

      if (
        parsedMonth !== undefined &&
        (!Number.isInteger(parsedMonth) ||
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
        (!Number.isInteger(parsedYear) ||
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

      try {
        const budgets = await listBudgets(
          request.workspace.id,
          parsedMonth,
          parsedYear,
        );

        return reply.status(200).send({
          status: 'success',
          budgets,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (
            error.message ===
              'Month must be an integer between 1 and 12' ||
            error.message ===
              'Year must be a valid integer greater than or equal to 2000' ||
            error.message ===
              'Month and year must be provided together'
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

      try {
        const progress =
          await getBudgetProgress(
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
          error.message ===
            'Budget not found'
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