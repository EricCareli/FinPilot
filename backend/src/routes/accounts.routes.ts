import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  createAccount,
  listAccounts,
} from '../services/account.service.js';

import { getAccountBalance } from '../services/account-balance.service.js';

export async function accountsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/accounts',
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
        name,
        type,
        currency,
        initialBalance,
      } = request.body as {
        name?: string;
        type?:
          | 'CHECKING'
          | 'SAVINGS'
          | 'CASH'
          | 'CREDIT_CARD'
          | 'INVESTMENT'
          | 'OTHER';
        currency?:
          | 'BRL'
          | 'USD'
          | 'EUR';
        initialBalance?: number;
      };

      if (
        !name ||
        !type ||
        !currency ||
        initialBalance === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Name, type, currency and initialBalance are required',
        });
      }

      const normalizedName =
        name.trim();

      if (normalizedName.length < 2) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Account name must contain at least 2 characters',
        });
      }

      if (
        ![
          'CHECKING',
          'SAVINGS',
          'CASH',
          'CREDIT_CARD',
          'INVESTMENT',
          'OTHER',
        ].includes(type)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid account type',
        });
      }

      if (
        !['BRL', 'USD', 'EUR'].includes(
          currency,
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid currency',
        });
      }

      if (
        !Number.isFinite(
          initialBalance,
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Initial balance must be a valid number',
        });
      }

      try {
        const account =
          await createAccount({
            workspaceId:
              request.workspace.id,
            name: normalizedName,
            type,
            currency,
            initialBalance,
          });

        return reply.status(201).send({
          status: 'success',
          account,
        });
      } catch (error) {
        if (
          error instanceof Error
        ) {
          if (
            error.message ===
            'Account name is required'
          ) {
            return reply
              .status(400)
              .send({
                status: 'error',
                message: error.message,
              });
          }

          if (
            error.message ===
            'Initial balance must be a valid number'
          ) {
            return reply
              .status(400)
              .send({
                status: 'error',
                message: error.message,
              });
          }
        }

        throw error;
      }
    },
  );

  app.get(
    '/accounts',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const accounts =
        await listAccounts(
          request.workspace.id,
        );

      return reply.status(200).send({
        status: 'success',
        accounts,
      });
    },
  );

  app.get(
    '/accounts/:accountId/balance',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const { accountId } =
        request.params as {
          accountId: string;
        };

      try {
        const balance =
          await getAccountBalance(
            request.workspace.id,
            accountId,
          );

        return reply.status(200).send({
          status: 'success',
          balance,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            'Account not found'
        ) {
          return reply.status(404).send({
            status: 'error',
            message:
              'Account not found',
          });
        }

        throw error;
      }
    },
  );
}