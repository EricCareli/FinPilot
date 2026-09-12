import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middlewares/auth.middleware.js';

import {
  requestEmailChange,
  verifyEmailChangeCode,
} from '../services/email-change.service.js';

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
      } = request.body as {
        name?: string;
      };

      if (name === undefined) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Name is required',
        });
      }

      const normalizedName =
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

      const user =
        await updateUserProfile({
          userId:
            request.user.sub,
          name:
            normalizedName,
        });

      return reply.status(200).send({
        status: 'success',
        user,
      });
    },
  );

  app.post(
    '/users/me/email-change/request',
    {
      preHandler: [
        authenticate,
      ],
    },
    async (request, reply) => {
      const {
        newEmail,
        currentPassword,
      } = request.body as {
        newEmail?: string;
        currentPassword?: string;
      };

      if (
        !newEmail ||
        !currentPassword
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'New email and current password are required',
        });
      }

      const result =
        await requestEmailChange({
          userId:
            request.user.sub,
          newEmail:
            newEmail
              .trim()
              .toLowerCase(),
          currentPassword,
        });

      return reply.status(200).send({
        status: 'success',
        message:
          'Email change verification code sent',
        newEmail:
          result.newEmail,
        expiresAt:
          result.expiresAt,
      });
    },
  );

  app.post(
    '/users/me/email-change/verify',
    {
      preHandler: [
        authenticate,
      ],
    },
    async (request, reply) => {
      const {
        code,
      } = request.body as {
        code?: string;
      };

      if (!code) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Verification code is required',
        });
      }

      const normalizedCode =
        code.trim();

      if (
        !/^\d{6}$/.test(
          normalizedCode,
        )
      ) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Verification code must contain exactly 6 digits',
        });
      }

      const user =
        await verifyEmailChangeCode({
          userId:
            request.user.sub,
          code:
            normalizedCode,
        });

      const token =
        await app.jwt.sign({
          sub: user.id,
          email:
            user.email,
        });

      return reply.status(200).send({
        status: 'success',
        message:
          'Email changed successfully',
        user,
        token,
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
