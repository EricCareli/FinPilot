import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { getDashboard } from '../services/dashboard.service.js';

export async function dashboardRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/dashboard',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const dashboard = await getDashboard(
        request.workspace.id,
      );

      return reply.status(200).send({
        status: 'success',
        dashboard,
      });
    },
  );
}