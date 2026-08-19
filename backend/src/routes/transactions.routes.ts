import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';
import {
  createTransaction,
  listTransactions,
} from '../services/transaction.service.js';

export async function transactionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/transactions',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        requireWorkspaceRoles('OWNER', 'ADMIN', 'FINANCE'),
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
        type?: 'INCOME' | 'EXPENSE';
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

      if (!['INCOME', 'EXPENSE'].includes(type)) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid transaction type',
        });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'Amount must be greater than zero',
        });
      }

      const normalizedDescription = description.trim();

      if (normalizedDescription.length < 2) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Description must contain at least 2 characters',
        });
      }

      const parsedDate = new Date(transactionDate);

      if (Number.isNaN(parsedDate.getTime())) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid transaction date',
        });
      }

      try {
        const transactionInput = {
          workspaceId: request.workspace.id,
          accountId,
          type,
          amount,
          description: normalizedDescription,
          transactionDate: parsedDate,
          ...(categoryId ? { categoryId } : {}),
        };

        const transaction = await createTransaction(
          transactionInput,
        );

        return reply.status(201).send({
          status: 'success',
          transaction,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Account not found'
        ) {
          return reply.status(404).send({
            status: 'error',
            message: 'Account not found',
          });
        }

        if (
          error instanceof Error &&
          error.message === 'Category not found'
        ) {
          return reply.status(404).send({
            status: 'error',
            message: 'Category not found',
          });
        }

        throw error;
      }
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
      const transactions = await listTransactions(
        request.workspace.id,
      );

      return reply.status(200).send({
        status: 'success',
        transactions,
      });
    },
  );
}