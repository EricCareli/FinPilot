import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';
import {
  createGoal,
  listGoals,
  getGoalProgress,
} from '../services/goal.service.js';

export async function goalsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/goals',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        requireWorkspaceRoles('OWNER', 'ADMIN', 'FINANCE'),
      ],
    },
    async (request, reply) => {
      const {
        name,
        targetAmount,
        deadline,
      } = request.body as {
        name?: string;
        targetAmount?: number;
        deadline?: string;
      };

      if (
        !name ||
        targetAmount === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Name and targetAmount are required',
        });
      }

      let parsedDeadline: Date | undefined;

      if (deadline !== undefined) {
        parsedDeadline = new Date(deadline);

        if (Number.isNaN(parsedDeadline.getTime())) {
          return reply.status(400).send({
            status: 'error',
            message: 'Invalid deadline',
          });
        }
      }

      try {
        const goal = await createGoal({
          workspaceId: request.workspace.id,
          name,
          targetAmount,
          ...(parsedDeadline
            ? { deadline: parsedDeadline }
            : {}),
        });

        return reply.status(201).send({
          status: 'success',
          goal,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (
            error.message ===
              'Goal name must contain at least 2 characters' ||
            error.message ===
              'Target amount must be greater than zero' ||
            error.message === 'Invalid deadline'
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
    '/goals',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const goals = await listGoals(
        request.workspace.id,
      );

      return reply.status(200).send({
        status: 'success',
        goals,
      });
    },
  );

  app.get(
    '/goals/:goalId/progress',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (request, reply) => {
      const { goalId } = request.params as {
        goalId: string;
      };

      try {
        const progress = await getGoalProgress(
          request.workspace.id,
          goalId,
        );

        return reply.status(200).send({
          status: 'success',
          progress,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Goal not found'
        ) {
          return reply.status(404).send({
            status: 'error',
            message: 'Goal not found',
          });
        }

        throw error;
      }
    },
  );
}