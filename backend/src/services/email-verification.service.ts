import { randomInt } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

const VERIFICATION_CODE_EXPIRATION_MINUTES =
  10;

const MAX_VERIFICATION_ATTEMPTS =
  5;

export async function createEmailVerificationCode(
  userId: string,
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        emailVerifiedAt: true,
      },
    });

  if (!user) {
    throw new AppError(
      'User not found',
      404,
    );
  }

  if (user.emailVerifiedAt) {
    throw new AppError(
      'Email already verified',
      400,
    );
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

  const expiresAt =
    new Date(
      now.getTime() +
        VERIFICATION_CODE_EXPIRATION_MINUTES *
          60 *
          1000,
    );

  await prisma.emailVerificationCode.upsert({
    where: {
      userId,
    },

    create: {
      userId,
      codeHash,
      attempts: 0,
      expiresAt,
      lastSentAt: now,
    },

    update: {
      codeHash,
      attempts: 0,
      expiresAt,
      lastSentAt: now,
    },
  });

  return {
    code,
    expiresAt,
  };
}

export async function verifyEmailCode({
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
      'Invalid verification code',
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
        name: true,
        email: true,
        emailVerifiedAt: true,

        emailVerificationCode: {
          select: {
            id: true,
            codeHash: true,
            attempts: true,
            expiresAt: true,
          },
        },
      },
    });

  if (!user) {
    throw new AppError(
      'Invalid verification code',
      400,
    );
  }

  if (user.emailVerifiedAt) {
    throw new AppError(
      'Email already verified',
      400,
    );
  }

  const verification =
    user.emailVerificationCode;

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
    await prisma.emailVerificationCode.delete({
      where: {
        id: verification.id,
      },
    });

    throw new AppError(
      'Verification code expired',
      400,
    );
  }

  if (
    verification.attempts >=
    MAX_VERIFICATION_ATTEMPTS
  ) {
    await prisma.emailVerificationCode.delete({
      where: {
        id: verification.id,
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
      MAX_VERIFICATION_ATTEMPTS
    ) {
      await prisma.emailVerificationCode.delete({
        where: {
          id: verification.id,
        },
      });

      throw new AppError(
        'Too many verification attempts',
        429,
      );
    }

    await prisma.emailVerificationCode.update({
      where: {
        id: verification.id,
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

  const verifiedAt =
    new Date();

  await prisma.$transaction(
    async (tx) => {
      await tx.user.update({
        where: {
          id: user.id,
        },

        data: {
          emailVerifiedAt:
            verifiedAt,
        },
      });

      await tx.emailVerificationCode.delete({
        where: {
          id: verification.id,
        },
      });
    },
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt:
      verifiedAt,
  };
}