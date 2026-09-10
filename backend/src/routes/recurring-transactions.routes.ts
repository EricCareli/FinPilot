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
  updateRecurringTransaction,
} from '../services/recurring-transaction.service.js';

type RecurringType =
  | 'INCOME'
  | 'EXPENSE';

type RecurringFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY';

function isRecurringType(
  value: string,
): value is RecurringType {
  return (
    value === 'INCOME' ||
    value === 'EXPENSE'
  );
}

function isRecurringFrequency(
  value: string,
): value is RecurringFrequency {
  return (
    value === 'DAILY' ||
    value === 'WEEKLY' ||
    value === 'MONTHLY' ||
    value === 'YEARLY'
  );
}

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
        type?: string;
        amount?: number;
        description?: string;
        frequency?: string;
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
        !isRecurringType(type)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Type must be INCOME or EXPENSE',
        });
      }

      if (
        !isRecurringFrequency(
          frequency,
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid frequency',
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

  app.patch(
    '/recurring-transactions/:id',
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

      const {
        accountId,
        categoryId,
        type,
        amount,
        description,
        frequency,
        nextRunDate,
        endDate,
      } = request.body as {
        accountId?: string;
        categoryId?: string | null;
        type?: string;
        amount?: number;
        description?: string;
        frequency?: string;
        nextRunDate?: string;
        endDate?: string | null;
      };

      if (
        accountId === undefined &&
        categoryId === undefined &&
        type === undefined &&
        amount === undefined &&
        description === undefined &&
        frequency === undefined &&
        nextRunDate === undefined &&
        endDate === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'At least one recurring transaction field must be provided',
        });
      }

      if (
        accountId !== undefined &&
        !accountId.trim()
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Account is required',
        });
      }

      if (
        typeof categoryId ===
          'string' &&
        !categoryId.trim()
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Category must be a valid id or null',
        });
      }

      let normalizedType:
        | RecurringType
        | undefined;

      if (type !== undefined) {
        if (
          !isRecurringType(type)
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Type must be INCOME or EXPENSE',
          });
        }

        normalizedType = type;
      }

      let normalizedFrequency:
        | RecurringFrequency
        | undefined;

      if (
        frequency !== undefined
      ) {
        if (
          !isRecurringFrequency(
            frequency,
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Invalid frequency',
          });
        }

        normalizedFrequency =
          frequency;
      }

      if (
        amount !== undefined &&
        (
          !Number.isFinite(amount) ||
          amount <= 0
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Amount must be greater than zero',
        });
      }

      let normalizedDescription:
        | string
        | undefined;

      if (
        description !== undefined
      ) {
        normalizedDescription =
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
      }

      let parsedNextRunDate:
        | Date
        | undefined;

      if (
        nextRunDate !== undefined
      ) {
        parsedNextRunDate =
          new Date(
            nextRunDate,
          );

        if (
          Number.isNaN(
            parsedNextRunDate.getTime(),
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Invalid next run date',
          });
        }
      }

      let parsedEndDate:
        | Date
        | null
        | undefined;

      if (endDate === null) {
        parsedEndDate = null;
      } else if (
        endDate !== undefined
      ) {
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
        await updateRecurringTransaction({
          workspaceId:
            request.workspace.id,
          recurringTransactionId:
            id,
          ...(accountId !==
          undefined
            ? {
                accountId:
                  accountId.trim(),
              }
            : {}),
          ...(categoryId !==
          undefined
            ? {
                categoryId,
              }
            : {}),
          ...(normalizedType !==
          undefined
            ? {
                type:
                  normalizedType,
              }
            : {}),
          ...(amount !== undefined
            ? { amount }
            : {}),
          ...(normalizedDescription !==
          undefined
            ? {
                description:
                  normalizedDescription,
              }
            : {}),
          ...(normalizedFrequency !==
          undefined
            ? {
                frequency:
                  normalizedFrequency,
              }
            : {}),
          ...(parsedNextRunDate !==
          undefined
            ? {
                nextRunDate:
                  parsedNextRunDate,
              }
            : {}),
          ...(parsedEndDate !==
          undefined
            ? {
                endDate:
                  parsedEndDate,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        recurringTransaction,
      });
    },
  );

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