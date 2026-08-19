import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { accountsRoutes } from './routes/accounts.routes.js';
import { categoriesRoutes } from './routes/categories.routes.js';
import { transactionsRoutes } from './routes/transactions.routes.js';
import { AppError } from './errors/app-error.js';
import { transfersRoutes } from './routes/transfers.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';

const PORT = Number(process.env.PORT) || 3333;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured');
}

const jwtSecret: string = JWT_SECRET;

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        status: 'error',
        message: error.message,
      });
    }

    if (
      typeof error === 'object' &&
      error !== null
    ) {
      const fastifyError = error as {
        validation?: unknown;
        code?: string;
        statusCode?: number;
        message?: string;
      };

      if (fastifyError.validation) {
        return reply.status(400).send({
          status: 'error',
          message: 'Request validation failed',
          details: fastifyError.validation,
        });
      }

      if (
        fastifyError.code ===
          'FST_ERR_CTP_INVALID_CONTENT_LENGTH' ||
        fastifyError.code ===
          'FST_ERR_CTP_BODY_TOO_LARGE'
      ) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request body',
        });
      }

      if (
        fastifyError.statusCode &&
        fastifyError.statusCode >= 400 &&
        fastifyError.statusCode < 500
      ) {
        return reply.status(fastifyError.statusCode).send({
          status: 'error',
          message:
            fastifyError.message ?? 'Request error',
        });
      }
    }

    return reply.status(500).send({
      status: 'error',
      message: 'Internal server error',
    });
  });

  await app.register(cors, {
    origin: true,
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
  await accountsRoutes(app);
  await categoriesRoutes(app);
  await transactionsRoutes(app);
  await transfersRoutes(app);
  await dashboardRoutes(app);

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({
      port: PORT,
      host: '0.0.0.0',
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();