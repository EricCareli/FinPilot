import { randomInt } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import { sendEmailChangeCode } from './email.service.js';

const EMAIL_CHANGE_CODE_EXPIRATION_MINUTES =
  10;

const MAX_EMAIL_CHANGE_ATTEMPTS =
  5;

const EMAIL_CHANGE_RESEND_COOLDOWN_MS =
  60 * 1000;

async function generateEmailChangeCode({
  userId,
  newEmail,
}: {
  userId: string;
  newEmail: string;
}) {
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

  const expiresAt =
    new Date(
      now.getTime() +
        EMAIL_CHANGE_CODE_EXPIRATION_MINUTES *
          60 *
          1000,
    );

  const verification =
    await prisma.emailChangeCode.upsert({
      where: {
        userId,
      },

      create: {
        userId,
        newEmail,
        codeHash,
        attempts: 0,
        expiresAt,
        lastSentAt: now,
      },

      update: {
        newEmail,
        codeHash,
        attempts: 0,
        expiresAt,
        lastSentAt: now,
      },

      select: {
        id: true,
      },
    });

  return {
    code,
    expiresAt,
    verificationId:
      verification.id,
  };
}

export async function requestEmailChange({
  userId,
  newEmail,
  currentPassword,
}: {
  userId: string;
  newEmail: string;
  currentPassword: string;
}) {
  const normalizedEmail =
    newEmail
      .trim()
      .toLowerCase();

  if (
    !normalizedEmail.includes('@')
  ) {
    throw new AppError(
      'Invalid email',
      400,
    );
  }

  if (!currentPassword) {
    throw new AppError(
      'Current password is required',
      400,
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,

        emailChangeCode: {
          select: {
            newEmail: true,
            lastSentAt: true,
          },
        },
      },
    });

  if (!user) {
    throw new AppError(
      'User not found',
      404,
    );
  }

  const passwordMatches =
    await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

  if (!passwordMatches) {
    throw new AppError(
      'Current password is incorrect',
      401,
    );
  }

  if (
    normalizedEmail ===
    user.email
  ) {
    throw new AppError(
      'New email must be different from current email',
      400,
    );
  }

  const existingUser =
    await prisma.user.findUnique({
      where: {
        email:
          normalizedEmail,
      },

      select: {
        id: true,
      },
    });

  if (existingUser) {
    throw new AppError(
      'Email already registered',
      409,
    );
  }

  const existingVerification =
    user.emailChangeCode;

  if (
    existingVerification &&
    existingVerification.newEmail ===
      normalizedEmail
  ) {
    const elapsed =
      Date.now() -
      existingVerification
        .lastSentAt
        .getTime();

    if (
      elapsed <
      EMAIL_CHANGE_RESEND_COOLDOWN_MS
    ) {
      const remainingMilliseconds =
        EMAIL_CHANGE_RESEND_COOLDOWN_MS -
        elapsed;

      const remainingSeconds =
        Math.ceil(
          remainingMilliseconds /
            1000,
        );

      throw new AppError(
        `Please wait ${remainingSeconds} seconds before requesting another email change code`,
        429,
      );
    }
  }

  const {
    code,
    expiresAt,
    verificationId,
  } =
    await generateEmailChangeCode({
      userId: user.id,
      newEmail:
        normalizedEmail,
    });

  try {
    await sendEmailChangeCode({
      email:
        normalizedEmail,
      name: user.name,
      code,
    });
  } catch (error) {
    await prisma.emailChangeCode.deleteMany({
      where: {
        id:
          verificationId,
      },
    });

    throw error;
  }

  return {
    newEmail:
      normalizedEmail,
    expiresAt,
  };
}

export async function verifyEmailChangeCode({
  userId,
  code,
}: {
  userId: string;
  code: string;
}) {
  const normalizedCode =
    code.trim();

  if (
    !/^\d{6}$/.test(
      normalizedCode,
    )
  ) {
    throw new AppError(
      'Invalid verification code',
      400,
    );
  }

  const verification =
    await prisma.emailChangeCode.findUnique({
      where: {
        userId,
      },

      select: {
        id: true,
        newEmail: true,
        codeHash: true,
        attempts: true,
        expiresAt: true,
      },
    });

  if (!verification) {
    throw new AppError(
      'Verification code not found',
      400,
    );
  }

  const now =
    new Date();

  if (
    verification.expiresAt <=
    now
  ) {
    await prisma.emailChangeCode.delete({
      where: {
        id:
          verification.id,
      },
    });

    throw new AppError(
      'Verification code expired',
      400,
    );
  }

  if (
    verification.attempts >=
    MAX_EMAIL_CHANGE_ATTEMPTS
  ) {
    await prisma.emailChangeCode.delete({
      where: {
        id:
          verification.id,
      },
    });

    throw new AppError(
      'Too many verification attempts',
      429,
    );
  }

  const codeMatches =
    await bcrypt.compare(
      normalizedCode,
      verification.codeHash,
    );

  if (!codeMatches) {
    const nextAttempts =
      verification.attempts + 1;

    if (
      nextAttempts >=
      MAX_EMAIL_CHANGE_ATTEMPTS
    ) {
      await prisma.emailChangeCode.delete({
        where: {
          id:
            verification.id,
        },
      });

      throw new AppError(
        'Too many verification attempts',
        429,
      );
    }

    await prisma.emailChangeCode.update({
      where: {
        id:
          verification.id,
      },

      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new AppError(
      'Invalid verification code',
      400,
    );
  }

  const existingUser =
    await prisma.user.findUnique({
      where: {
        email:
          verification.newEmail,
      },

      select: {
        id: true,
      },
    });

  if (
    existingUser &&
    existingUser.id !== userId
  ) {
    await prisma.emailChangeCode.delete({
      where: {
        id:
          verification.id,
      },
    });

    throw new AppError(
      'Email already registered',
      409,
    );
  }

  const user =
    await prisma.$transaction(
      async (tx) => {
        const updatedUser =
          await tx.user.update({
            where: {
              id: userId,
            },

            data: {
              email:
                verification.newEmail,
              emailVerifiedAt:
                new Date(),
            },

            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              updatedAt: true,
            },
          });

        await tx.emailChangeCode.delete({
          where: {
            id:
              verification.id,
          },
        });

        return updatedUser;
      },
    );

  return user;
}
