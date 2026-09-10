import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';

import {
  changeUserPassword,
  getUserProfile,
  updateUserProfile,
} from '../services/user.service.js';

export async function usersRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/users/me',
    {
      preHandler: [
        authenticate,
      ],
    },
    async (request, reply) => {
      const user =
        await getUserProfile(
          request.user.sub,
        );

      return reply.status(200).send({
        status: 'success',
        user,
      });
    },
  );

  app.patch(
    '/users/me',
    {
      preHandler: [
        authenticate,
      ],
    },
    async (request, reply) => {
      const {
        name,
        email,
      } = request.body as {
        name?: string;
        email?: string;
      };

      if (
        name === undefined &&
        email === undefined
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'At least one profile field must be provided',
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
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Name must contain at least 2 characters',
            });
        }
      }

      let normalizedEmail:
        | string
        | undefined;

      if (email !== undefined) {
        normalizedEmail =
          email
            .trim()
            .toLowerCase();

        if (
          !normalizedEmail.includes('@')
        ) {
          return reply
            .status(400)
            .send({
              status: 'error',
              message:
                'Invalid email',
            });
        }
      }

      const user =
        await updateUserProfile({
          userId:
            request.user.sub,
          ...(normalizedName !==
          undefined
            ? {
                name:
                  normalizedName,
              }
            : {}),
          ...(normalizedEmail !==
          undefined
            ? {
                email:
                  normalizedEmail,
              }
            : {}),
        });

      return reply.status(200).send({
        status: 'success',
        user,
      });
    },
  );

  app.patch(
    '/users/me/password',
    {
      preHandler: [
        authenticate,
      ],
    },
    async (request, reply) => {
      const {
        currentPassword,
        newPassword,
      } = request.body as {
        currentPassword?: string;
        newPassword?: string;
      };

      if (
        !currentPassword ||
        !newPassword
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Current password and new password are required',
        });
      }

      if (
        newPassword.length < 8
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'New password must contain at least 8 characters',
        });
      }

      const result =
        await changeUserPassword({
          userId:
            request.user.sub,
          currentPassword,
          newPassword,
        });

      return reply.status(200).send({
        status: 'success',
        ...result,
      });
    },
  );
}