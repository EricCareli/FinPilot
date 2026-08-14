import type { FastifyInstance } from 'fastify';
import { checkDatabaseHealth } from '../services/health.service.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const databaseHealthy = await checkDatabaseHealth();

    if (!databaseHealthy) {
      return reply.status(503).send({
        status: 'error',
        service: 'finpilot-api',
        database: 'unavailable',
      });
    }

    return {
      status: 'ok',
      service: 'finpilot-api',
      database: 'ok',
    };
  });
}