import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/users/me',
    {
      preHandler: [authenticate, workspaceMiddleware],
    },
    async (request, reply) => {
      const userId = request.user.sub;

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          status: 'error',
          message: 'User not found',
        });
      }

      return {
        status: 'success',
        user,
        workspace: request.workspace,
      };
    },
  );
}