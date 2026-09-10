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
  updateCreditCardPurchase,
  voidCreditCardPurchase,
} from '../services/credit-card-purchase.service.js';

import {
  closeCreditCardInvoice,
  createInvoice,
  listInvoices,
} from '../services/credit-card-invoice.service.js';

import {
  payCreditCardInvoice,
} from '../services/credit-card-payment.service.js';

import {
  assertStandaloneCreditCardPurchase,
  createCreditCardInstallmentPurchase,
  getCreditCardInstallmentPurchase,
  listCreditCardInstallmentPurchases,
  updateCreditCardInstallmentPurchase,
  voidCreditCardInstallmentPurchase,
} from '../services/credit-card-installment.service.js';

import {
  refundCreditCardInstallmentPurchase,
} from '../services/credit-card-installment-refund.service.js';

export async function creditCardsRoutes(
  app: FastifyInstance,
): Promise<void> {
  const financeRoles =
    requireWorkspaceRoles(
      'OWNER',
      'ADMIN',
      'FINANCE',
    );

  app.post(
    '/credit-cards',
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

      const creditCard =
        await getCreditCard(
          request.workspace.id,
          accountId,
        );

      return reply.status(200).send({
        status: 'success',
        creditCard,
      });
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

      const limit =
        await getCreditCardLimit(
          request.workspace.id,
          accountId,
        );

      return reply.status(200).send({
        status: 'success',
        limit,
      });
    },
  );

  app.post(
    '/credit-cards/:accountId/purchases',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
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
        new Date(
          transactionDate,
        );

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

      const result =
        await createCreditCardPurchase({
          workspaceId:
            request.workspace.id,
          accountId,
          ...(categoryId
            ? {
                categoryId,
              }
            : {}),
          amount,
          description,
          transactionDate:
            parsedDate,
        });

      return reply.status(201).send({
        status: 'success',
        ...result,
      });
    },
  );

  app.post(
    '/credit-cards/:accountId/installment-purchases',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { accountId } =
        request.params as {
          accountId: string;
        };

      const {
        categoryId,
        totalAmount,
        description,
        installmentCount,
        purchaseDate,
      } = request.body as {
        categoryId?: string;
        totalAmount?: number;
        description?: string;
        installmentCount?: number;
        purchaseDate?: string;
      };

      if (
        totalAmount === undefined ||
        !description ||
        installmentCount ===
          undefined ||
        !purchaseDate
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Total amount, description, installmentCount and purchaseDate are required',
        });
      }

      const parsedPurchaseDate =
        new Date(
          purchaseDate,
        );

      if (
        Number.isNaN(
          parsedPurchaseDate.getTime(),
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid purchase date',
        });
      }

      const installmentPurchase =
        await createCreditCardInstallmentPurchase({
          workspaceId:
            request.workspace.id,
          accountId,
          ...(categoryId
            ? {
                categoryId,
              }
            : {}),
          totalAmount,
          description,
          installmentCount,
          purchaseDate:
            parsedPurchaseDate,
        });

      return reply.status(201).send({
        status: 'success',
        installmentPurchase,
      });
    },
  );

  app.get(
    '/credit-cards/:accountId/installment-purchases',
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

      const installmentPurchases =
        await listCreditCardInstallmentPurchases(
          request.workspace.id,
          accountId,
        );

      return reply.status(200).send({
        status: 'success',
        installmentPurchases,
      });
    },
  );

  app.get(
    '/credit-cards/installment-purchases/:purchaseId',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const { purchaseId } =
        request.params as {
          purchaseId: string;
        };

      const installmentPurchase =
        await getCreditCardInstallmentPurchase(
          request.workspace.id,
          purchaseId,
        );

      return reply.status(200).send({
        status: 'success',
        installmentPurchase,
      });
    },
  );

  app.patch(
    '/credit-cards/installment-purchases/:purchaseId',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { purchaseId } =
        request.params as {
          purchaseId: string;
        };

      const {
        categoryId,
        totalAmount,
        description,
        installmentCount,
        purchaseDate,
      } = request.body as {
        categoryId?:
          | string
          | null;
        totalAmount?: number;
        description?: string;
        installmentCount?: number;
        purchaseDate?: string;
      };

      let parsedPurchaseDate:
        | Date
        | undefined;

      if (
        purchaseDate !== undefined
      ) {
        parsedPurchaseDate =
          new Date(
            purchaseDate,
          );

        if (
          Number.isNaN(
            parsedPurchaseDate.getTime(),
          )
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Invalid purchase date',
            });
        }
      }

      const installmentPurchase =
        await updateCreditCardInstallmentPurchase({
          workspaceId:
            request.workspace.id,
          installmentPurchaseId:
            purchaseId,
          ...(categoryId !==
          undefined
            ? {
                categoryId,
              }
            : {}),
          ...(totalAmount !==
          undefined
            ? {
                totalAmount,
              }
            : {}),
          ...(description !==
          undefined
            ? {
                description,
              }
            : {}),
          ...(installmentCount !==
          undefined
            ? {
                installmentCount,
              }
            : {}),
          ...(parsedPurchaseDate !==
          undefined
            ? {
                purchaseDate:
                  parsedPurchaseDate,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        installmentPurchase,
      });
    },
  );

  /*
   * REEMBOLSO
   *
   * Usado quando pelo menos uma parcela
   * já pertence a fatura fechada,
   * vencida ou paga.
   */
  app.post(
    '/credit-cards/installment-purchases/:purchaseId/refund',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { purchaseId } =
        request.params as {
          purchaseId: string;
        };

      const {
        refundDate,
      } = request.body as {
        refundDate?: string;
      };

      if (!refundDate) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Refund date is required',
        });
      }

      const parsedRefundDate =
        new Date(
          refundDate,
        );

      if (
        Number.isNaN(
          parsedRefundDate.getTime(),
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid refund date',
        });
      }

      const result =
        await refundCreditCardInstallmentPurchase({
          workspaceId:
            request.workspace.id,
          installmentPurchaseId:
            purchaseId,
          refundDate:
            parsedRefundDate,
        });

      return reply.status(200).send({
        status: 'success',
        ...result,
      });
    },
  );

  app.post(
    '/credit-cards/installment-purchases/:purchaseId/void',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { purchaseId } =
        request.params as {
          purchaseId: string;
        };

      const installmentPurchase =
        await voidCreditCardInstallmentPurchase({
          workspaceId:
            request.workspace.id,
          installmentPurchaseId:
            purchaseId,
        });

      return reply.status(200).send({
        status: 'success',
        installmentPurchase,
      });
    },
  );

  app.patch(
    '/credit-cards/purchases/:transactionId',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { transactionId } =
        request.params as {
          transactionId: string;
        };

      const {
        categoryId,
        amount,
        description,
        transactionDate,
      } = request.body as {
        categoryId?:
          | string
          | null;
        amount?: number;
        description?: string;
        transactionDate?: string;
      };

      let parsedDate:
        | Date
        | undefined;

      if (
        transactionDate !== undefined
      ) {
        parsedDate =
          new Date(
            transactionDate,
          );

        if (
          Number.isNaN(
            parsedDate.getTime(),
          )
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Invalid transaction date',
            });
        }
      }

      await assertStandaloneCreditCardPurchase(
        request.workspace.id,
        transactionId,
      );

      const purchase =
        await updateCreditCardPurchase({
          workspaceId:
            request.workspace.id,
          transactionId,
          ...(categoryId !==
          undefined
            ? {
                categoryId,
              }
            : {}),
          ...(amount !== undefined
            ? {
                amount,
              }
            : {}),
          ...(description !==
          undefined
            ? {
                description,
              }
            : {}),
          ...(parsedDate !==
          undefined
            ? {
                transactionDate:
                  parsedDate,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        purchase,
      });
    },
  );

  app.post(
    '/credit-cards/purchases/:transactionId/void',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { transactionId } =
        request.params as {
          transactionId: string;
        };

      await assertStandaloneCreditCardPurchase(
        request.workspace.id,
        transactionId,
      );

      const purchase =
        await voidCreditCardPurchase({
          workspaceId:
            request.workspace.id,
          transactionId,
        });

      return reply.status(200).send({
        status: 'success',
        purchase,
      });
    },
  );

  app.post(
    '/credit-cards/:accountId/invoices',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
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
    '/credit-cards/invoices/:invoiceId/close',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
      ],
    },
    async (request, reply) => {
      const { invoiceId } =
        request.params as {
          invoiceId: string;
        };

      const invoice =
        await closeCreditCardInvoice({
          workspaceId:
            request.workspace.id,
          invoiceId,
        });

      return reply.status(200).send({
        status: 'success',
        invoice,
      });
    },
  );

  app.post(
    '/credit-cards/invoices/:invoiceId/pay',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        financeRoles,
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
        new Date(
          paymentDate,
        );

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

      const result =
        await payCreditCardInvoice({
          workspaceId:
            request.workspace.id,
          invoiceId,
          paymentAccountId,
          paymentDate:
            parsedDate,
        });

      return reply.status(200).send({
        status: 'success',
        payment: result,
      });
    },
  );
}