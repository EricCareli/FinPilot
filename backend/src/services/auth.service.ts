import bcrypt from 'bcryptjs';

import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import {
  createEmailVerificationCode,
} from './email-verification.service.js';
import {
  sendVerificationCode,
} from './email.service.js';

const VERIFICATION_RESEND_COOLDOWN_MS =
  60 * 1000;

export async function registerUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const existingUser =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (existingUser) {
    throw new AppError(
      'Email already registered',
      409,
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const user =
          await tx.user.create({
            data: {
              name,
              email,
              passwordHash,
            },
          });

        const workspace =
          await tx.workspace.create({
            data: {
              name: 'Personal',
              type: 'PERSONAL',
            },
          });

        await tx.workspaceMember.create({
          data: {
            workspaceId:
              workspace.id,
            userId: user.id,
            role: 'OWNER',
          },
        });

        return user;
      },
    );

  const {
    code,
  } =
    await createEmailVerificationCode(
      result.id,
    );

  await sendVerificationCode({
    email: result.email,
    name: result.name,
    code,
  });

  return {
    id: result.id,
    name: result.name,
    email: result.email,
    createdAt:
      result.createdAt,
  };
}

export async function resendVerificationEmail({
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
        emailVerifiedAt: true,

        emailVerificationCode: {
          select: {
            lastSentAt: true,
          },
        },
      },
    });

  if (
    !user ||
    user.emailVerifiedAt
  ) {
    return;
  }

  const existingVerification =
    user.emailVerificationCode;

  if (existingVerification) {
    const elapsed =
      Date.now() -
      existingVerification
        .lastSentAt
        .getTime();

    if (
      elapsed <
      VERIFICATION_RESEND_COOLDOWN_MS
    ) {
      const remainingMilliseconds =
        VERIFICATION_RESEND_COOLDOWN_MS -
        elapsed;

      const remainingSeconds =
        Math.ceil(
          remainingMilliseconds /
            1000,
        );

      throw new AppError(
        `Please wait ${remainingSeconds} seconds before requesting another verification code`,
        429,
      );
    }
  }

  const {
    code,
  } =
    await createEmailVerificationCode(
      user.id,
    );

  await sendVerificationCode({
    email: user.email,
    name: user.name,
    code,
  });
}

export async function loginUser({
  email,
  password,
}: {
  email: string;
  password: string;
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
    });

  if (!user) {
    throw new AppError(
      'Invalid email or password',
      401,
    );
  }

  const passwordMatches =
    await bcrypt.compare(
      password,
      user.passwordHash,
    );

  if (!passwordMatches) {
    throw new AppError(
      'Invalid email or password',
      401,
    );
  }

  if (!user.emailVerifiedAt) {
    throw new AppError(
      'Email not verified',
      403,
    );
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}