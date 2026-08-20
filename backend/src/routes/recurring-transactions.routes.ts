import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  createRecurringTransaction,
  listRecurringTransactions,
  executeRecurringTransaction,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  cancelRecurringTransaction,
} from '../services/recurring-transaction.service.js';

export async function recurringTransactionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  const financeRoles = requireWorkspaceRoles(
    'OWNER',
    'ADMIN',
    'FINANCE',
  );

  app.post(
    '/recurring-transactions',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const {
        accountId,
        categoryId,
        type,
        amount,
        description,
        frequency,
        startDate,
        endDate,
      } = request.body as {
        accountId?: string;
        categoryId?: string;
        type?: 'INCOME' | 'EXPENSE';
        amount?: number;
        description?: string;
        frequency?:
          | 'DAILY'
          | 'WEEKLY'
          | 'MONTHLY'
          | 'YEARLY';
        startDate?: string;
        endDate?: string;
      };

      if (
        !accountId ||
        !type ||
        amount === undefined ||
        !description ||
        !frequency ||
        !startDate
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Account, type, amount, description, frequency and startDate are required',
        });
      }

      if (
        type !== 'INCOME' &&
        type !== 'EXPENSE'
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Type must be INCOME or EXPENSE',
        });
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Amount must be greater than zero',
        });
      }

      const normalizedDescription =
        description.trim();

      if (normalizedDescription.length < 2) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Description must contain at least 2 characters',
        });
      }

      const validFrequencies = [
        'DAILY',
        'WEEKLY',
        'MONTHLY',
        'YEARLY',
      ] as const;

      if (
        !validFrequencies.includes(frequency)
      ) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid frequency',
        });
      }

      const parsedStartDate = new Date(
        startDate,
      );

      if (
        Number.isNaN(
          parsedStartDate.getTime(),
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid start date',
        });
      }

      let parsedEndDate: Date | undefined;

      if (endDate) {
        parsedEndDate = new Date(endDate);

        if (
          Number.isNaN(
            parsedEndDate.getTime(),
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message: 'Invalid end date',
          });
        }
      }

      try {
        const recurringTransaction =
          await createRecurringTransaction({
            workspaceId: request.workspace.id,
            accountId,
            ...(categoryId
              ? { categoryId }
              : {}),
            type,
            amount,
            description:
              normalizedDescription,
            frequency,
            startDate:
              parsedStartDate,
            ...(parsedEndDate
              ? {
                  endDate: parsedEndDate,
                }
              : {}),
          });

        return reply.status(201).send({
          status: 'success',
          recurringTransaction,
        });
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        switch (error.message) {
          case 'Account not found':
          case 'Category not found':
            return reply.status(404).send({
              status: 'error',
              message: error.message,
            });

          case 'Recurring transaction type must be INCOME or EXPENSE':
          case 'Recurring transaction amount must be greater than zero':
          case 'Description is required':
          case 'Invalid start date':
          case 'Invalid end date':
          case 'End date must be greater than or equal to start date':
          case 'Category type must match recurring transaction type':
            return reply.status(400).send({
              status: 'error',
              message: error.message,
            });

          default:
            throw error;
        }
      }
    },
  );

  app.get(
    '/recurring-transactions',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const recurringTransactions =
        await listRecurringTransactions(
          request.workspace.id,
        );

      return reply.status(200).send({
        status: 'success',
        recurringTransactions,
      });
    },
  );

  app.post(
    '/recurring-transactions/:id/execute',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { id } = request.params as {
        id?: string;
      };

      if (!id) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Recurring transaction id is required',
        });
      }

      try {
        const result =
          await executeRecurringTransaction(
            request.workspace.id,
            id,
          );

        return reply.status(201).send({
          status: 'success',
          result,
        });
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        switch (error.message) {
          case 'Recurring transaction not found':
          case 'Account not found':
            return reply.status(404).send({
              status: 'error',
              message: error.message,
            });

          case 'Recurring transaction is not active':
          case 'Recurring transaction is not due yet':
            return reply.status(400).send({
              status: 'error',
              message: error.message,
            });

          default:
            throw error;
        }
      }
    },
  );

  app.post(
    '/recurring-transactions/:id/pause',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { id } = request.params as {
        id?: string;
      };

      if (!id) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Recurring transaction id is required',
        });
      }

      try {
        const recurringTransaction =
          await pauseRecurringTransaction(
            request.workspace.id,
            id,
          );

        return reply.status(200).send({
          status: 'success',
          recurringTransaction,
        });
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        switch (error.message) {
          case 'Recurring transaction not found':
            return reply.status(404).send({
              status: 'error',
              message: error.message,
            });

          case 'Cancelled recurring transaction cannot be paused':
          case 'Recurring transaction is already paused':
            return reply.status(400).send({
              status: 'error',
              message: error.message,
            });

          default:
            throw error;
        }
      }
    },
  );

  app.post(
    '/recurring-transactions/:id/resume',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { id } = request.params as {
        id?: string;
      };

      if (!id) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Recurring transaction id is required',
        });
      }

      try {
        const recurringTransaction =
          await resumeRecurringTransaction(
            request.workspace.id,
            id,
          );

        return reply.status(200).send({
          status: 'success',
          recurringTransaction,
        });
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        switch (error.message) {
          case 'Recurring transaction not found':
            return reply.status(404).send({
              status: 'error',
              message: error.message,
            });

          case 'Cancelled recurring transaction cannot be resumed':
          case 'Recurring transaction is already active':
            return reply.status(400).send({
              status: 'error',
              message: error.message,
            });

          default:
            throw error;
        }
      }
    },
  );

  app.post(
    '/recurring-transactions/:id/cancel',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { id } = request.params as {
        id?: string;
      };

      if (!id) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Recurring transaction id is required',
        });
      }

      try {
        const recurringTransaction =
          await cancelRecurringTransaction(
            request.workspace.id,
            id,
          );

        return reply.status(200).send({
          status: 'success',
          recurringTransaction,
        });
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        switch (error.message) {
          case 'Recurring transaction not found':
            return reply.status(404).send({
              status: 'error',
              message: error.message,
            });

          case 'Recurring transaction is already cancelled':
            return reply.status(400).send({
              status: 'error',
              message: error.message,
            });

          default:
            throw error;
        }
      }
    },
  );
}