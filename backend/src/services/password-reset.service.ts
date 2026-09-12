import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

import bcrypt from 'bcryptjs';

import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import {
  sendPasswordResetCode,
} from './email.service.js';

const RESET_CODE_EXPIRATION_MINUTES =
  10;

const RESET_TOKEN_EXPIRATION_MINUTES =
  10;

const MAX_RESET_ATTEMPTS =
  5;

const RESET_RESEND_COOLDOWN_MS =
  60 * 1000;

function hashResetToken(
  token: string,
): string {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

export async function requestPasswordReset({
  email,
}: {
  email: string;
}) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          normalizedEmail,
      },

      select: {
        id: true,
        name: true,
        email: true,

        passwordResetCode: {
          select: {
            lastSentAt: true,
          },
        },
      },
    });

  /*
   * Retornamos silenciosamente quando
   * o usuário não existe para evitar
   * revelar quais e-mails possuem conta.
   */
  if (!user) {
    return;
  }

  const existingReset =
    user.passwordResetCode;

  if (existingReset) {
    const elapsed =
      Date.now() -
      existingReset
        .lastSentAt
        .getTime();

    if (
      elapsed <
      RESET_RESEND_COOLDOWN_MS
    ) {
      return;
    }
  }

  const code =
    randomInt(
      100000,
      1000000,
    ).toString();

  const codeHash =
    await bcrypt.hash(
      code,
      12,
    );

  const now =
    new Date();

  const codeExpiresAt =
    new Date(
      now.getTime() +
        RESET_CODE_EXPIRATION_MINUTES *
          60 *
          1000,
    );

  await prisma.passwordResetCode.upsert({
    where: {
      userId: user.id,
    },

    create: {
      userId: user.id,
      codeHash,
      attempts: 0,
      codeExpiresAt,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      lastSentAt: now,
    },

    update: {
      codeHash,
      attempts: 0,
      codeExpiresAt,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      lastSentAt: now,
    },
  });

  try {
    await sendPasswordResetCode({
      email: user.email,
      name: user.name,
      code,
    });
  } catch (error) {
    await prisma.passwordResetCode.deleteMany({
      where: {
        userId: user.id,
        codeHash,
      },
    });

    throw error;
  }
}

export async function verifyPasswordResetCode({
  email,
  code,
}: {
  email: string;
  code: string;
}) {
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
    throw new AppError(
      'Invalid password reset code',
      400,
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          normalizedEmail,
      },

      select: {
        id: true,

        passwordResetCode: {
          select: {
            id: true,
            codeHash: true,
            attempts: true,
            codeExpiresAt: true,
          },
        },
      },
    });

  if (
    !user ||
    !user.passwordResetCode
  ) {
    throw new AppError(
      'Invalid password reset code',
      400,
    );
  }

  const reset =
    user.passwordResetCode;

  const now =
    new Date();

  if (
    reset.codeExpiresAt <=
    now
  ) {
    await prisma.passwordResetCode.delete({
      where: {
        id: reset.id,
      },
    });

    throw new AppError(
      'Password reset code expired',
      400,
    );
  }

  if (
    reset.attempts >=
    MAX_RESET_ATTEMPTS
  ) {
    await prisma.passwordResetCode.delete({
      where: {
        id: reset.id,
      },
    });

    throw new AppError(
      'Too many password reset attempts',
      429,
    );
  }

  const codeMatches =
    await bcrypt.compare(
      normalizedCode,
      reset.codeHash,
    );

  if (!codeMatches) {
    const nextAttempts =
      reset.attempts + 1;

    if (
      nextAttempts >=
      MAX_RESET_ATTEMPTS
    ) {
      await prisma.passwordResetCode.delete({
        where: {
          id: reset.id,
        },
      });

      throw new AppError(
        'Too many password reset attempts',
        429,
      );
    }

    await prisma.passwordResetCode.update({
      where: {
        id: reset.id,
      },

      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new AppError(
      'Invalid password reset code',
      400,
    );
  }

  const resetToken =
    randomBytes(
      32,
    ).toString('hex');

  const resetTokenHash =
    hashResetToken(
      resetToken,
    );

  const resetTokenExpiresAt =
    new Date(
      now.getTime() +
        RESET_TOKEN_EXPIRATION_MINUTES *
          60 *
          1000,
    );

  await prisma.passwordResetCode.update({
    where: {
      id: reset.id,
    },

    data: {
      resetTokenHash,
      resetTokenExpiresAt,
      codeExpiresAt: now,
      attempts: 0,
    },
  });

  return {
    resetToken,
    expiresAt:
      resetTokenExpiresAt,
  };
}

export async function resetPassword({
  email,
  resetToken,
  newPassword,
}: {
  email: string;
  resetToken: string;
  newPassword: string;
}) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  const normalizedToken =
    resetToken.trim();

  if (
    normalizedToken.length ===
    0
  ) {
    throw new AppError(
      'Invalid password reset token',
      400,
    );
  }

  if (
    newPassword.length < 8
  ) {
    throw new AppError(
      'Password must contain at least 8 characters',
      400,
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          normalizedEmail,
      },

      select: {
        id: true,

        passwordResetCode: {
          select: {
            id: true,
            resetTokenHash: true,
            resetTokenExpiresAt: true,
          },
        },
      },
    });

  if (
    !user ||
    !user.passwordResetCode
  ) {
    throw new AppError(
      'Invalid password reset token',
      400,
    );
  }

  const reset =
    user.passwordResetCode;

  const storedResetTokenHash =
    reset.resetTokenHash;

  const resetTokenExpiresAt =
    reset.resetTokenExpiresAt;

  if (
    !storedResetTokenHash ||
    !resetTokenExpiresAt
  ) {
    throw new AppError(
      'Invalid password reset token',
      400,
    );
  }

  const now =
    new Date();

  if (
    resetTokenExpiresAt <=
    now
  ) {
    await prisma.passwordResetCode.delete({
      where: {
        id: reset.id,
      },
    });

    throw new AppError(
      'Password reset token expired',
      400,
    );
  }

  const suppliedTokenHash =
    hashResetToken(
      normalizedToken,
    );

  const storedHashBuffer =
    Buffer.from(
      storedResetTokenHash,
      'hex',
    );

  const suppliedHashBuffer =
    Buffer.from(
      suppliedTokenHash,
      'hex',
    );

  const tokenMatches =
    storedHashBuffer.length ===
      suppliedHashBuffer.length &&
    timingSafeEqual(
      storedHashBuffer,
      suppliedHashBuffer,
    );

  if (!tokenMatches) {
    throw new AppError(
      'Invalid password reset token',
      400,
    );
  }

  const passwordHash =
    await bcrypt.hash(
      newPassword,
      12,
    );

  await prisma.$transaction(
    async (tx) => {
      await tx.user.update({
        where: {
          id: user.id,
        },

        data: {
          passwordHash,
        },
      });

      await tx.passwordResetCode.delete({
        where: {
          id: reset.id,
        },
      });
    },
  );
}