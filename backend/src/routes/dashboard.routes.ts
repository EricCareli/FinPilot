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
      const { month, year } = request.query as {
        month?: string;
        year?: string;
      };

      let parsedMonth: number | undefined;
      let parsedYear: number | undefined;

      if (month !== undefined) {
        parsedMonth = Number(month);

        if (
          !Number.isInteger(parsedMonth) ||
          parsedMonth < 1 ||
          parsedMonth > 12
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Month must be an integer between 1 and 12',
          });
        }
      }

      if (year !== undefined) {
        parsedYear = Number(year);

        if (
          !Number.isInteger(parsedYear) ||
          parsedYear < 2000
        ) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Year must be a valid integer greater than or equal to 2000',
          });
        }
      }

      if (
        (parsedMonth !== undefined &&
          parsedYear === undefined) ||
        (parsedMonth === undefined &&
          parsedYear !== undefined)
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Month and year must be provided together',
        });
      }

      try {
        const dashboard = await getDashboard(
          request.workspace.id,
          {
            ...(parsedMonth !== undefined
              ? { month: parsedMonth }
              : {}),
            ...(parsedYear !== undefined
              ? { year: parsedYear }
              : {}),
          },
        );

        return reply.status(200).send({
          status: 'success',
          dashboard,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (
            error.message ===
              'Month must be between 1 and 12' ||
            error.message ===
              'Invalid year' ||
            error.message ===
              'Month and year must be provided together'
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