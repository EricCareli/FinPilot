import bcrypt from 'bcryptjs';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface UpdateUserProfileInput {
  userId: string;
  name: string;
}

export interface ChangeUserPasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export async function getUserProfile(
  userId: string,
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  if (!user) {
    throw new AppError(
      'User not found',
      404,
    );
  }

  return user;
}

export async function updateUserProfile(
  input: UpdateUserProfileInput,
) {
  const normalizedName =
    input.name.trim();

  if (
    normalizedName.length < 2
  ) {
    throw new AppError(
      'Name must contain at least 2 characters',
      400,
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        id: true,
      },
    });

  if (!user) {
    throw new AppError(
      'User not found',
      404,
    );
  }

  return prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      name:
        normalizedName,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function changeUserPassword(
  input: ChangeUserPasswordInput,
) {
  if (!input.currentPassword) {
    throw new AppError(
      'Current password is required',
      400,
    );
  }

  if (
    input.newPassword.length < 8
  ) {
    throw new AppError(
      'New password must contain at least 8 characters',
      400,
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        id: true,
        passwordHash: true,
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
      input.currentPassword,
      user.passwordHash,
    );

  if (!passwordMatches) {
    throw new AppError(
      'Current password is incorrect',
      401,
    );
  }

  const newPasswordMatchesCurrent =
    await bcrypt.compare(
      input.newPassword,
      user.passwordHash,
    );

  if (newPasswordMatchesCurrent) {
    throw new AppError(
      'New password must be different from current password',
      400,
    );
  }

  const passwordHash =
    await bcrypt.hash(
      input.newPassword,
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

      await tx.passwordResetCode.deleteMany({
        where: {
          userId: user.id,
        },
      });
    },
  );

  return {
    message:
      'Password changed successfully',
  };
}
