import type {
  FastifyInstance,
} from 'fastify';

import {
  loginUser,
  registerUser,
  resendVerificationEmail,
} from '../services/auth.service.js';

import {
  verifyEmailCode,
} from '../services/email-verification.service.js';

import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from '../services/password-reset.service.js';

export async function authRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/auth/register',
    async (
      request,
      reply,
    ) => {
      const {
        name,
        email,
        password,
      } =
        request.body as {
          name?: string;
          email?: string;
          password?: string;
        };

      if (
        !name ||
        !email ||
        !password
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Name, email and password are required',
          });
      }

      const normalizedName =
        name.trim();

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        normalizedName.length <
        2
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Name must contain at least 2 characters',
          });
      }

      if (
        !normalizedEmail.includes(
          '@',
        )
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Invalid email',
          });
      }

      if (
        password.length < 8
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Password must contain at least 8 characters',
          });
      }

      const user =
        await registerUser({
          name: normalizedName,
          email:
            normalizedEmail,
          password,
        });

      return reply
        .status(201)
        .send({
          status: 'success',
          user,
          verificationRequired:
            true,
        });
    },
  );

  app.post(
    '/auth/verify-email',
    async (
      request,
      reply,
    ) => {
      const {
        email,
        code,
      } =
        request.body as {
          email?: string;
          code?: string;
        };

      if (
        !email ||
        !code
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Email and verification code are required',
          });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const normalizedCode =
        code.trim();

      if (
        !/^\d{6}$/.test(
          normalizedCode,
        )
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Verification code must contain exactly 6 digits',
          });
      }

      const user =
        await verifyEmailCode({
          email:
            normalizedEmail,
          code:
            normalizedCode,
        });

      return reply
        .status(200)
        .send({
          status: 'success',
          message:
            'Email verified successfully',
          user,
        });
    },
  );

  app.post(
    '/auth/resend-verification',
    async (
      request,
      reply,
    ) => {
      const {
        email,
      } =
        request.body as {
          email?: string;
        };

      if (!email) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Email is required',
          });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        !normalizedEmail.includes(
          '@',
        )
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Invalid email',
          });
      }

      await resendVerificationEmail({
        email:
          normalizedEmail,
      });

      return reply
        .status(200)
        .send({
          status: 'success',
          message:
            'If the account exists and is not verified, a new verification code was sent',
        });
    },
  );

  app.post(
    '/auth/forgot-password',
    async (
      request,
      reply,
    ) => {
      const {
        email,
      } =
        request.body as {
          email?: string;
        };

      if (!email) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Email is required',
          });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        !normalizedEmail.includes(
          '@',
        )
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Invalid email',
          });
      }

      await requestPasswordReset({
        email:
          normalizedEmail,
      });

      return reply
        .status(200)
        .send({
          status: 'success',
          message:
            'If an account exists for this email, a password reset code was sent',
        });
    },
  );

  app.post(
    '/auth/verify-password-reset',
    async (
      request,
      reply,
    ) => {
      const {
        email,
        code,
      } =
        request.body as {
          email?: string;
          code?: string;
        };

      if (
        !email ||
        !code
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Email and password reset code are required',
          });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const normalizedCode =
        code.trim();

      if (
        !/^\d{6}$/.test(
          normalizedCode,
        )
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Password reset code must contain exactly 6 digits',
          });
      }

      const result =
        await verifyPasswordResetCode({
          email:
            normalizedEmail,
          code:
            normalizedCode,
        });

      return reply
        .status(200)
        .send({
          status: 'success',
          message:
            'Password reset code verified successfully',
          resetToken:
            result.resetToken,
          expiresAt:
            result.expiresAt,
        });
    },
  );

  app.post(
    '/auth/reset-password',
    async (
      request,
      reply,
    ) => {
      const {
        email,
        resetToken,
        newPassword,
      } =
        request.body as {
          email?: string;
          resetToken?: string;
          newPassword?: string;
        };

      if (
        !email ||
        !resetToken ||
        !newPassword
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Email, reset token and new password are required',
          });
      }

      if (
        newPassword.length < 8
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Password must contain at least 8 characters',
          });
      }

      await resetPassword({
        email:
          email
            .trim()
            .toLowerCase(),
        resetToken,
        newPassword,
      });

      return reply
        .status(200)
        .send({
          status: 'success',
          message:
            'Password reset successfully',
        });
    },
  );

  app.post(
    '/auth/login',
    async (
      request,
      reply,
    ) => {
      const {
        email,
        password,
      } =
        request.body as {
          email?: string;
          password?: string;
        };

      if (
        !email ||
        !password
      ) {
        return reply
          .status(400)
          .send({
            status: 'error',
            message:
              'Email and password are required',
          });
      }

      const user =
        await loginUser({
          email,
          password,
        });

      const token =
        await app.jwt.sign({
          sub: user.id,
          email:
            user.email,
        });

      return reply
        .status(200)
        .send({
          status: 'success',
          user,
          token,
        });
    },
  );
}