import type { FastifyInstance } from 'fastify';
import type {
  TransactionType,
} from '../generated/prisma/client.js';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  createTransaction,
  listTransactions,
  updateTransaction,
  voidTransaction,
} from '../services/transaction.service.js';

function isEditableTransactionType(
  value: string,
): value is TransactionType {
  return (
    value === 'INCOME' ||
    value === 'EXPENSE'
  );
}

export async function transactionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/transactions',
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
        accountId,
        categoryId,
        type,
        amount,
        description,
        transactionDate,
      } = request.body as {
        accountId?: string;
        categoryId?: string;
        type?: string;
        amount?: number;
        description?: string;
        transactionDate?: string;
      };

      if (
        !accountId ||
        !type ||
        amount === undefined ||
        !description ||
        !transactionDate
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Account, type, amount, description and transactionDate are required',
        });
      }

      if (!isEditableTransactionType(type)) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid transaction type',
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
        normalizedDescription.length < 2
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Description must contain at least 2 characters',
        });
      }

      const parsedDate =
        new Date(transactionDate);

      if (
        Number.isNaN(
          parsedDate.getTime(),
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid transaction date',
        });
      }

      const transaction =
        await createTransaction({
          workspaceId:
            request.workspace.id,
          accountId,
          type,
          amount,
          description:
            normalizedDescription,
          transactionDate: parsedDate,
          ...(categoryId
            ? { categoryId }
            : {}),
        });

      return reply.status(201).send({
        status: 'success',
        transaction,
      });
    },
  );

  app.get(
    '/transactions',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const { includeVoided } =
        request.query as {
          includeVoided?: string;
        };

      if (
        includeVoided !== undefined &&
        includeVoided !== 'true' &&
        includeVoided !== 'false'
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'includeVoided must be true or false',
        });
      }

      const transactions =
        await listTransactions(
          request.workspace.id,
          includeVoided === 'true',
        );

      return reply.status(200).send({
        status: 'success',
        transactions,
      });
    },
  );

  app.patch(
    '/transactions/:transactionId',
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
      const { transactionId } =
        request.params as {
          transactionId: string;
        };

      const {
        accountId,
        categoryId,
        type,
        amount,
        description,
        transactionDate,
      } = request.body as {
        accountId?: string;
        categoryId?: string | null;
        type?: string;
        amount?: number;
        description?: string;
        transactionDate?: string;
      };

      if (
        accountId === undefined &&
        categoryId === undefined &&
        type === undefined &&
        amount === undefined &&
        description === undefined &&
        transactionDate === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'At least one transaction field must be provided',
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

      let normalizedType:
        | TransactionType
        | undefined;

      if (type !== undefined) {
        if (!isEditableTransactionType(type)) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Invalid transaction type',
          });
        }

        normalizedType = type;
      }

      if (
        amount !== undefined &&
        (!Number.isFinite(amount) ||
          amount <= 0)
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

      if (description !== undefined) {
        normalizedDescription =
          description.trim();

        if (
          normalizedDescription.length < 2
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Description must contain at least 2 characters',
          });
        }
      }

      if (
        typeof categoryId === 'string' &&
        !categoryId.trim()
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Category must be a valid id or null',
        });
      }

      let parsedDate:
        | Date
        | undefined;

      if (transactionDate !== undefined) {
        parsedDate =
          new Date(transactionDate);

        if (
          Number.isNaN(
            parsedDate.getTime(),
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Invalid transaction date',
          });
        }
      }

      const transaction =
        await updateTransaction({
          workspaceId:
            request.workspace.id,
          transactionId,
          ...(accountId !== undefined
            ? { accountId }
            : {}),
          ...(categoryId !== undefined
            ? { categoryId }
            : {}),
          ...(normalizedType !== undefined
            ? { type: normalizedType }
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
          ...(parsedDate !== undefined
            ? {
                transactionDate:
                  parsedDate,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        transaction,
      });
    },
  );

  app.post(
    '/transactions/:transactionId/void',
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
      const { transactionId } =
        request.params as {
          transactionId: string;
        };

      const transaction =
        await voidTransaction({
          workspaceId:
            request.workspace.id,
          transactionId,
        });

      return reply.status(200).send({
        status: 'success',
        transaction,
      });
    },
  );
}