import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { workspacesRoutes } from './routes/workspaces.routes.js';
import { accountsRoutes } from './routes/accounts.routes.js';
import { categoriesRoutes } from './routes/categories.routes.js';
import { transactionsRoutes } from './routes/transactions.routes.js';
import { transfersRoutes } from './routes/transfers.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { budgetsRoutes } from './routes/budgets.routes.js';
import { goalsRoutes } from './routes/goals.routes.js';
import { creditCardsRoutes } from './routes/credit-cards.routes.js';
import { recurringTransactionsRoutes } from './routes/recurring-transactions.routes.js';

import {
  processAllDueRecurringTransactions,
} from './services/recurring-transaction.service.js';

import { AppError } from './errors/app-error.js';

const PORT =
  Number(process.env.PORT) || 3333;

const RECURRING_PROCESSOR_INTERVAL_MS =
  60_000;

const JWT_SECRET =
  process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not configured',
  );
}

const jwtSecret: string =
  JWT_SECRET;

const corsOrigins =
  (
    process.env.CORS_ORIGIN ??
    'http://localhost:5173'
  )
    .split(',')
    .map((origin) =>
      origin.trim(),
    )
    .filter(Boolean);

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler(
    (error, request, reply) => {
      request.log.error(error);

      if (
        error instanceof AppError
      ) {
        return reply
          .status(error.statusCode)
          .send({
            status: 'error',
            message: error.message,
          });
      }

      if (
        typeof error === 'object' &&
        error !== null
      ) {
        const fastifyError =
          error as {
            validation?: unknown;
            code?: string;
            statusCode?: number;
            message?: string;
          };

        if (
          fastifyError.validation
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Request validation failed',
              details:
                fastifyError.validation,
            });
        }

        if (
          fastifyError.code ===
          'FST_ERR_CTP_INVALID_CONTENT_LENGTH'
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Request body length does not match Content-Length',
            });
        }

        if (
          fastifyError.code ===
          'FST_ERR_CTP_BODY_TOO_LARGE'
        ) {
          return reply
            .status(413)
            .send({
              status: 'error',
              message:
                'Request body is too large',
            });
        }

        if (
          fastifyError.statusCode &&
          fastifyError.statusCode >=
            400 &&
          fastifyError.statusCode <
            500
        ) {
          return reply
            .status(
              fastifyError.statusCode,
            )
            .send({
              status: 'error',
              message:
                fastifyError.message ??
                'Request error',
            });
        }
      }

      return reply
        .status(500)
        .send({
          status: 'error',
          message:
            'Internal server error',
        });
    },
  );

  await app.register(cors, {
    origin: (
      origin,
      callback,
    ) => {
      if (
        !origin ||
        corsOrigins.includes(
          origin,
        )
      ) {
        callback(
          null,
          true,
        );

        return;
      }

      callback(
        null,
        false,
      );
    },

    methods: [
      'GET',
      'HEAD',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-workspace-id',
    ],
  });

  await app.register(jwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: '1h',
    },
  });

  await healthRoutes(app);
  await authRoutes(app);
  await usersRoutes(app);
  await workspacesRoutes(app);
  await accountsRoutes(app);
  await categoriesRoutes(app);
  await transactionsRoutes(app);
  await transfersRoutes(app);
  await dashboardRoutes(app);
  await budgetsRoutes(app);
  await goalsRoutes(app);
  await creditCardsRoutes(app);

  await recurringTransactionsRoutes(
    app,
  );

  return app;
}

function setupRecurringProcessor(
  app: Awaited<
    ReturnType<
      typeof buildServer
    >
  >,
) {
  let timer:
    | ReturnType<
        typeof setInterval
      >
    | null = null;

  let currentRun:
    | Promise<void>
    | null = null;

  let stopped = false;

  async function processRecurringTransactions() {
    if (
      stopped ||
      currentRun !== null
    ) {
      return;
    }

    currentRun =
      (async () => {
        try {
          const result =
            await processAllDueRecurringTransactions();

          const processedCount =
            result.results.reduce(
              (
                total,
                workspace,
              ) =>
                total +
                workspace.processedCount,
              0,
            );

          const failedCount =
            result.results.reduce(
              (
                total,
                workspace,
              ) =>
                total +
                workspace.failedCount,
              0,
            );

          if (
            processedCount > 0 ||
            failedCount > 0
          ) {
            app.log.info(
              {
                workspaceCount:
                  result.workspaceCount,
                processedCount,
                failedCount,
              },
              'Recurring transactions processed',
            );
          }

          if (
            failedCount > 0
          ) {
            app.log.warn(
              {
                results:
                  result.results,
              },
              'Some recurring transactions failed',
            );
          }
        } catch (error) {
          app.log.error(
            {
              err: error,
            },
            'Recurring transaction processor failed',
          );
        }
      })();

    try {
      await currentRun;
    } finally {
      currentRun = null;
    }
  }

  function startProcessor() {
    if (
      stopped ||
      timer !== null
    ) {
      return;
    }

    /*
     * Process overdue recurring
     * transactions immediately
     * when the API starts.
     */
    void processRecurringTransactions();

    timer = setInterval(
      () => {
        void processRecurringTransactions();
      },
      RECURRING_PROCESSOR_INTERVAL_MS,
    );

    /*
     * The timer itself should not keep
     * the Node.js process alive.
     */
    timer.unref();

    app.log.info(
      {
        intervalMs:
          RECURRING_PROCESSOR_INTERVAL_MS,
      },
      'Recurring transaction processor started',
    );
  }

  app.addHook(
    'onClose',
    async () => {
      stopped = true;

      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      if (currentRun) {
        await currentRun;
      }

      app.log.info(
        'Recurring transaction processor stopped',
      );
    },
  );

  return {
    start: startProcessor,
  };
}

async function start() {
  const app =
    await buildServer();

  const recurringProcessor =
    setupRecurringProcessor(
      app,
    );

  let shuttingDown = false;

  async function shutdown(
    signal: string,
  ) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    app.log.info(
      {
        signal,
      },
      'Shutting down server',
    );

    try {
      await app.close();

      app.log.info(
        'Server stopped successfully',
      );

      process.exit(0);
    } catch (error) {
      app.log.error(
        {
          err: error,
        },
        'Failed to stop server gracefully',
      );

      process.exit(1);
    }
  }

  process.once(
    'SIGINT',
    () => {
      void shutdown(
        'SIGINT',
      );
    },
  );

  process.once(
    'SIGTERM',
    () => {
      void shutdown(
        'SIGTERM',
      );
    },
  );

  try {
    await app.listen({
      port: PORT,
      host: '0.0.0.0',
    });

    recurringProcessor.start();
  } catch (error) {
    app.log.error(error);

    await app.close();

    process.exit(1);
  }
}

void start();