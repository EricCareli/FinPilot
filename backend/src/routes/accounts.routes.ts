import type { FastifyInstance } from 'fastify';

import type {
  AccountType,
  Currency,
} from '../generated/prisma/client.js';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  archiveAccount,
  createAccount,
  listAccounts,
  updateAccount,
} from '../services/account.service.js';

import { getAccountBalance } from '../services/account-balance.service.js';

const accountTypes = [
  'CHECKING',
  'SAVINGS',
  'CASH',
  'CREDIT_CARD',
  'INVESTMENT',
  'OTHER',
] as const;

const currencies = [
  'BRL',
  'USD',
  'EUR',
] as const;

function isAccountType(
  value: string,
): value is AccountType {
  return accountTypes.some(
    (type) => type === value,
  );
}

function isCurrency(
  value: string,
): value is Currency {
  return currencies.some(
    (currency) =>
      currency === value,
  );
}

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
        type?: string;
        currency?: string;
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

      if (
        normalizedName.length < 2
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Account name must contain at least 2 characters',
        });
      }

      if (!isAccountType(type)) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid account type',
        });
      }

      if (!isCurrency(currency)) {
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
      const { includeArchived } =
        request.query as {
          includeArchived?: string;
        };

      if (
        includeArchived !==
          undefined &&
        includeArchived !== 'true' &&
        includeArchived !== 'false'
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'includeArchived must be true or false',
        });
      }

      const accounts =
        await listAccounts(
          request.workspace.id,
          includeArchived === 'true',
        );

      return reply.status(200).send({
        status: 'success',
        accounts,
      });
    },
  );

  app.patch(
    '/accounts/:accountId',
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
      const { accountId } =
        request.params as {
          accountId: string;
        };

      const {
        name,
        type,
        currency,
      } = request.body as {
        name?: string;
        type?: string;
        currency?: string;
      };

      if (
        name === undefined &&
        type === undefined &&
        currency === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'At least one account field must be provided',
        });
      }

      let normalizedName:
        | string
        | undefined;

      if (name !== undefined) {
        normalizedName =
          name.trim();

        if (
          normalizedName.length < 2
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Account name must contain at least 2 characters',
            });
        }
      }

      let normalizedType:
        | AccountType
        | undefined;

      if (type !== undefined) {
        if (
          !isAccountType(type)
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Invalid account type',
            });
        }

        normalizedType = type;
      }

      let normalizedCurrency:
        | Currency
        | undefined;

      if (
        currency !== undefined
      ) {
        if (
          !isCurrency(currency)
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Invalid currency',
            });
        }

        normalizedCurrency =
          currency;
      }

      const account =
        await updateAccount({
          workspaceId:
            request.workspace.id,
          accountId,
          ...(normalizedName !==
          undefined
            ? {
                name:
                  normalizedName,
              }
            : {}),
          ...(normalizedType !==
          undefined
            ? {
                type:
                  normalizedType,
              }
            : {}),
          ...(normalizedCurrency !==
          undefined
            ? {
                currency:
                  normalizedCurrency,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        account,
      });
    },
  );

  app.post(
    '/accounts/:accountId/archive',
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
      const { accountId } =
        request.params as {
          accountId: string;
        };

      const account =
        await archiveAccount({
          workspaceId:
            request.workspace.id,
          accountId,
        });

      return reply.status(200).send({
        status: 'success',
        account,
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