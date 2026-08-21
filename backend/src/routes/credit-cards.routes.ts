import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  createCreditCard,
  getCreditCard,
} from '../services/credit-card.service.js';

import {
  getCreditCardLimit,
} from '../services/credit-card-limit.service.js';

import {
  createCreditCardPurchase,
} from '../services/credit-card-purchase.service.js';

import {
  createInvoice,
  listInvoices,
} from '../services/credit-card-invoice.service.js';

import {
  payCreditCardInvoice,
} from '../services/credit-card-payment.service.js';

export async function creditCardsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/credit-cards',
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
        creditLimit,
        closingDay,
        dueDay,
      } = request.body as {
        accountId?: string;
        creditLimit?: number;
        closingDay?: number;
        dueDay?: number;
      };

      if (
        !accountId ||
        creditLimit === undefined ||
        closingDay === undefined ||
        dueDay === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Account, creditLimit, closingDay and dueDay are required',
        });
      }

      try {
        const creditCard =
          await createCreditCard({
            workspaceId:
              request.workspace.id,
            accountId,
            creditLimit,
            closingDay,
            dueDay,
          });

        return reply.status(201).send({
          status: 'success',
          creditCard,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (
            error.message ===
              'Account not found' ||
            error.message ===
              'Account must be a credit card account' ||
            error.message ===
              'Credit limit must be greater than zero' ||
            error.message ===
              'Invalid closing day' ||
            error.message ===
              'Invalid due day' ||
            error.message ===
              'Credit card already configured for this account'
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
    '/credit-cards/:accountId',
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
        const creditCard =
          await getCreditCard(
            request.workspace.id,
            accountId,
          );

        return reply.status(200).send({
          status: 'success',
          creditCard,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            'Credit card not found'
        ) {
          return reply.status(404).send({
            status: 'error',
            message: 'Credit card not found',
          });
        }

        throw error;
      }
    },
  );

  app.get(
    '/credit-cards/:accountId/limit',
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
        const limit =
          await getCreditCardLimit(
            request.workspace.id,
            accountId,
          );

        return reply.status(200).send({
          status: 'success',
          limit,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            'Credit card not found'
        ) {
          return reply.status(404).send({
            status: 'error',
            message: 'Credit card not found',
          });
        }

        throw error;
      }
    },
  );

  app.post(
    '/credit-cards/:accountId/purchases',
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
        categoryId,
        amount,
        description,
        transactionDate,
      } = request.body as {
        categoryId?: string;
        amount?: number;
        description?: string;
        transactionDate?: string;
      };

      if (
        amount === undefined ||
        !description ||
        !transactionDate
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Amount, description and transactionDate are required',
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

      try {
        const result =
          await createCreditCardPurchase({
            workspaceId:
              request.workspace.id,
            accountId,
            ...(categoryId
              ? { categoryId }
              : {}),
            amount,
            description,
            transactionDate: parsedDate,
          });

        return reply.status(201).send({
          status: 'success',
          ...result,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (
            error.message ===
              'Credit card not found' ||
            error.message ===
              'Purchase amount must be greater than zero' ||
            error.message ===
              'Description is required' ||
            error.message ===
              'Category not found' ||
            error.message ===
              'Invalid transaction date' ||
            error.message ===
              'Invoice for this purchase cycle is already paid' ||
            error.message ===
              'Invoice is not open'
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message: error.message,
          });
        }

        if (
          error instanceof Error &&
          error.message ===
            'Insufficient credit limit'
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

  app.post(
    '/credit-cards/:accountId/invoices',
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
        month,
        year,
      } = request.body as {
        month?: number;
        year?: number;
      };

      if (
        month === undefined ||
        year === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Month and year are required',
        });
      }

      try {
        const invoice =
          await createInvoice({
            workspaceId:
              request.workspace.id,
            accountId,
            month,
            year,
          });

        return reply.status(201).send({
          status: 'success',
          invoice,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (
            error.message ===
              'Credit card not found' ||
            error.message ===
              'Invalid month' ||
            error.message ===
              'Invalid year' ||
            error.message ===
              'Invoice already exists'
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
    '/credit-cards/:accountId/invoices',
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

      const invoices =
        await listInvoices(
          request.workspace.id,
          accountId,
        );

      return reply.status(200).send({
        status: 'success',
        invoices,
      });
    },
  );

  app.post(
    '/credit-cards/invoices/:invoiceId/pay',
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
      const { invoiceId } =
        request.params as {
          invoiceId: string;
        };

      const {
        paymentAccountId,
        paymentDate,
      } = request.body as {
        paymentAccountId?: string;
        paymentDate?: string;
      };

      if (
        !paymentAccountId ||
        !paymentDate
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Payment account and payment date are required',
        });
      }

      const parsedDate =
        new Date(paymentDate);

      if (
        Number.isNaN(
          parsedDate.getTime(),
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid payment date',
        });
      }

      try {
        const result =
          await payCreditCardInvoice({
            workspaceId:
              request.workspace.id,
            invoiceId,
            paymentAccountId,
            paymentDate: parsedDate,
          });

        return reply.status(200).send({
          status: 'success',
          payment: result,
        });
      } catch (error) {
        if (
          !(error instanceof Error)
        ) {
          throw error;
        }

        if (
          error.message ===
          'Invoice not found'
        ) {
          return reply.status(404).send({
            status: 'error',
            message: error.message,
          });
        }

        const badRequestErrors = [
          'Invoice is not open',
          'Payment account not found',
          'Payment account cannot be a credit card',
          'Payment account currency does not match invoice currency',
          'Insufficient funds',
        ];

        if (
          badRequestErrors.includes(
            error.message,
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
}