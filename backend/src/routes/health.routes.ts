import type {
  FastifyInstance,
} from 'fastify';

import {
  checkDatabaseHealth,
  getApplicationHealth,
} from '../services/health.service.js';

export async function healthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/health/live',
    async () => {
      return {
        status: 'ok',
        ...getApplicationHealth(),
      };
    },
  );

  app.get(
    '/health/ready',
    async (
      _request,
      reply,
    ) => {
      const database =
        await checkDatabaseHealth();

      const response = {
        status:
          database.status === 'ok'
            ? 'ok'
            : 'error',
        ...getApplicationHealth(),

        checks: {
          database,
        },
      };

      if (
        database.status !== 'ok'
      ) {
        return reply
          .status(503)
          .send(response);
      }

      return reply
        .status(200)
        .send(response);
    },
  );

  app.get(
    '/health',
    async (
      _request,
      reply,
    ) => {
      const database =
        await checkDatabaseHealth();

      const response = {
        status:
          database.status === 'ok'
            ? 'ok'
            : 'error',
        ...getApplicationHealth(),

        checks: {
          database,
        },
      };

      if (
        database.status !== 'ok'
      ) {
        return reply
          .status(503)
          .send(response);
      }

      return reply
        .status(200)
        .send(response);
    },
  );
}