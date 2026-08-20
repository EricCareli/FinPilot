import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import { createTransfer } from '../services/transfer.service.js';

export async function transfersRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/transfers',
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
        sourceAccountId,
        destinationAccountId,
        amount,
        description,
        transactionDate,
      } = request.body as {
        sourceAccountId?: string;
        destinationAccountId?: string;
        amount?: number;
        description?: string;
        transactionDate?: string;
      };

      if (
        !sourceAccountId ||
        !destinationAccountId ||
        amount === undefined ||
        !description ||
        !transactionDate
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Source account, destination account, amount, description and transactionDate are required',
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

      const parsedDate = new Date(
        transactionDate,
      );

      if (Number.isNaN(parsedDate.getTime())) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid transaction date',
        });
      }

      try {
        const transfer = await createTransfer({
          workspaceId: request.workspace.id,
          sourceAccountId,
          destinationAccountId,
          amount,
          description: normalizedDescription,
          transactionDate: parsedDate,
        });

        return reply.status(201).send({
          status: 'success',
          transfer,
        });
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        switch (error.message) {
          case 'Source and destination accounts must be different':
          case 'Transfer amount must be greater than zero':
          case 'Description is required':
          case 'Invalid transaction date':
          case 'Source and destination accounts must use the same currency':
          case 'Insufficient funds':
            return reply.status(400).send({
              status: 'error',
              message: error.message,
            });

          case 'Source account not found':
          case 'Destination account not found':
            return reply.status(404).send({
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