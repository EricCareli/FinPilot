import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';
import { workspaceMiddleware } from '../middlewares/workspace.middleware.js';
import { requireWorkspaceRoles } from '../middlewares/permission.middleware.js';

import {
  createGoal,
  deleteGoal,
  getGoalProgress,
  listGoals,
  updateGoal,
  updateGoalAmount,
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

      const normalizedName =
        name.trim();

      if (
        normalizedName.length < 2
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Goal name must contain at least 2 characters',
        });
      }

      if (
        !Number.isFinite(
          targetAmount,
        ) ||
        targetAmount <= 0
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Target amount must be greater than zero',
        });
      }

      let parsedDeadline:
        | Date
        | undefined;

      if (deadline !== undefined) {
        parsedDeadline =
          new Date(deadline);

        if (
          Number.isNaN(
            parsedDeadline.getTime(),
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Invalid deadline',
          });
        }
      }

      const goal =
        await createGoal({
          workspaceId:
            request.workspace.id,
          name: normalizedName,
          targetAmount,
          ...(parsedDeadline !== undefined
            ? {
                deadline:
                  parsedDeadline,
              }
            : {}),
        });

      return reply.status(201).send({
        status: 'success',
        goal,
      });
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
      const goals =
        await listGoals(
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
      const { goalId } =
        request.params as {
          goalId: string;
        };

      const progress =
        await getGoalProgress(
          request.workspace.id,
          goalId,
        );

      return reply.status(200).send({
        status: 'success',
        progress,
      });
    },
  );

  app.patch(
    '/goals/:goalId',
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
      const { goalId } =
        request.params as {
          goalId: string;
        };

      const {
        name,
        targetAmount,
        deadline,
      } = request.body as {
        name?: string;
        targetAmount?: number;
        deadline?: string | null;
      };

      if (
        name === undefined &&
        targetAmount === undefined &&
        deadline === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'At least one goal field must be provided',
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
          return reply.status(400).send({
            status: 'error',
            message:
              'Goal name must contain at least 2 characters',
          });
        }
      }

      if (
        targetAmount !== undefined &&
        (!Number.isFinite(
          targetAmount,
        ) ||
          targetAmount <= 0)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Target amount must be greater than zero',
        });
      }

      let parsedDeadline:
        | Date
        | null
        | undefined;

      if (deadline === null) {
        parsedDeadline = null;
      } else if (
        deadline !== undefined
      ) {
        parsedDeadline =
          new Date(deadline);

        if (
          Number.isNaN(
            parsedDeadline.getTime(),
          )
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Invalid deadline',
          });
        }
      }

      const goal =
        await updateGoal({
          workspaceId:
            request.workspace.id,
          goalId,
          ...(normalizedName !== undefined
            ? {
                name:
                  normalizedName,
              }
            : {}),
          ...(targetAmount !== undefined
            ? {
                targetAmount,
              }
            : {}),
          ...(parsedDeadline !== undefined
            ? {
                deadline:
                  parsedDeadline,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        goal,
      });
    },
  );

  app.patch(
    '/goals/:goalId/amount',
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
      const { goalId } =
        request.params as {
          goalId: string;
        };

      const {
        currentAmount,
      } = request.body as {
        currentAmount?: number;
      };

      if (
        currentAmount === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Current amount is required',
        });
      }

      if (
        !Number.isFinite(
          currentAmount,
        ) ||
        currentAmount < 0
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Current amount must be greater than or equal to zero',
        });
      }

      const goal =
        await updateGoalAmount({
          workspaceId:
            request.workspace.id,
          goalId,
          currentAmount,
        });

      return reply.status(200).send({
        status: 'success',
        goal,
      });
    },
  );

  app.delete(
    '/goals/:goalId',
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
      const { goalId } =
        request.params as {
          goalId: string;
        };

      const goal =
        await deleteGoal({
          workspaceId:
            request.workspace.id,
          goalId,
        });

      return reply.status(200).send({
        status: 'success',
        deletedGoal: goal,
      });
    },
  );
}