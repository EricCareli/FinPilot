import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  cancelRecurringTransaction,
  createRecurringTransaction,
  executeRecurringTransaction,
  listRecurringTransactions,
  pauseRecurringTransaction,
  processDueRecurringTransactions,
  resumeRecurringTransaction,
} from '../services/recurring-transaction.service.js';

export async function recurringTransactionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  const financeRoles =
    requireWorkspaceRoles(
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
        type?:
          | 'INCOME'
          | 'EXPENSE';
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

      if (
        normalizedDescription.length <
        2
      ) {
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
        !validFrequencies.includes(
          frequency,
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid frequency',
        });
      }

      const parsedStartDate =
        new Date(startDate);

      if (
        Number.isNaN(
          parsedStartDate.getTime(),
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid start date',
        });
      }

      let parsedEndDate:
        | Date
        | undefined;

      if (endDate) {
        parsedEndDate =
          new Date(endDate);

        if (
          Number.isNaN(
            parsedEndDate.getTime(),
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Invalid end date',
          });
        }
      }

      const recurringTransaction =
        await createRecurringTransaction({
          workspaceId:
            request.workspace.id,
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
                endDate:
                  parsedEndDate,
              }
            : {}),
        });

      return reply.status(201).send({
        status: 'success',
        recurringTransaction,
      });
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

  /*
   * Executes every occurrence currently due
   * for this workspace.
   *
   * This endpoint also gives us an easy way
   * to test the automatic processor before
   * connecting it to the server scheduler.
   */
  app.post(
    '/recurring-transactions/process-due',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const result =
        await processDueRecurringTransactions(
          request.workspace.id,
        );

      return reply.status(200).send({
        status: 'success',
        result,
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
      const { id } =
        request.params as {
          id?: string;
        };

      if (!id) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Recurring transaction id is required',
        });
      }

      const result =
        await executeRecurringTransaction(
          request.workspace.id,
          id,
        );

      return reply.status(201).send({
        status: 'success',
        result,
      });
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
      const { id } =
        request.params as {
          id?: string;
        };

      if (!id) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Recurring transaction id is required',
        });
      }

      const recurringTransaction =
        await pauseRecurringTransaction(
          request.workspace.id,
          id,
        );

      return reply.status(200).send({
        status: 'success',
        recurringTransaction,
      });
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
      const { id } =
        request.params as {
          id?: string;
        };

      if (!id) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Recurring transaction id is required',
        });
      }

      const recurringTransaction =
        await resumeRecurringTransaction(
          request.workspace.id,
          id,
        );

      return reply.status(200).send({
        status: 'success',
        recurringTransaction,
      });
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
      const { id } =
        request.params as {
          id?: string;
        };

      if (!id) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Recurring transaction id is required',
        });
      }

      const recurringTransaction =
        await cancelRecurringTransaction(
          request.workspace.id,
          id,
        );

      return reply.status(200).send({
        status: 'success',
        recurringTransaction,
      });
    },
  );
}