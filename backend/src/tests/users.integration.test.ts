import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'vitest';

import {
  prisma,
} from '../lib/prisma.js';

import {
  changeUserPassword,
  getUserProfile,
  updateUserProfile,
} from '../services/user.service.js';

const TEST_EMAIL_PREFIX =
  'finpilot_user_test_';

async function createTestUser(
  options: {
    name?: string;
    email?: string;
    password?: string;
  } = {},
) {
  const password =
    options.password ??
    'Password123!';

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  return prisma.user.create({
    data: {
      name:
        options.name ??
        'FinPilot User Test',
      email:
        options.email ??
        `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`,
      passwordHash,
    },
  });
}

async function cleanupTestData() {
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith:
          TEST_EMAIL_PREFIX,
      },
    },
  });
}

beforeAll(
  async () => {
    await cleanupTestData();
  },
);

afterEach(
  async () => {
    await cleanupTestData();
  },
);

afterAll(
  async () => {
    await cleanupTestData();

    await prisma.$disconnect();
  },
);

describe(
  'Users',
  () => {
    test(
      'returns the current user profile without exposing the password hash',
      async () => {
        const user =
          await createTestUser({
            name:
              'Eric Teste',
          });

        const profile =
          await getUserProfile(
            user.id,
          );

        expect(
          profile.id,
        ).toBe(user.id);

        expect(
          profile.name,
        ).toBe('Eric Teste');

        expect(
          profile.email,
        ).toBe(user.email);

        expect(
          profile.createdAt,
        ).toBeInstanceOf(Date);

        expect(
          profile.updatedAt,
        ).toBeInstanceOf(Date);

        expect(
          'passwordHash' in profile,
        ).toBe(false);
      },
    );

    test(
      'rejects profile lookup for a missing user',
      async () => {
        await expect(
          getUserProfile(
            randomUUID(),
          ),
        ).rejects.toThrow(
          'User not found',
        );
      },
    );

    test(
      'updates and normalizes user name and email',
      async () => {
        const user =
          await createTestUser();

        const newEmail =
          `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`;

        const updated =
          await updateUserProfile({
            userId:
              user.id,
            name:
              '  Eric Atualizado  ',
            email:
              `  ${newEmail.toUpperCase()}  `,
          });

        expect(
          updated.name,
        ).toBe(
          'Eric Atualizado',
        );

        expect(
          updated.email,
        ).toBe(
          newEmail.toLowerCase(),
        );

        expect(
          'passwordHash' in updated,
        ).toBe(false);

        const persisted =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                user.id,
            },
          });

        expect(
          persisted.name,
        ).toBe(
          'Eric Atualizado',
        );

        expect(
          persisted.email,
        ).toBe(
          newEmail.toLowerCase(),
        );
      },
    );

    test(
      'validates profile update fields',
      async () => {
        const user =
          await createTestUser();

        await expect(
          updateUserProfile({
            userId:
              user.id,
          }),
        ).rejects.toThrow(
          'At least one profile field must be provided',
        );

        await expect(
          updateUserProfile({
            userId:
              user.id,
            name:
              ' A ',
          }),
        ).rejects.toThrow(
          'Name must contain at least 2 characters',
        );

        await expect(
          updateUserProfile({
            userId:
              user.id,
            email:
              'invalid-email',
          }),
        ).rejects.toThrow(
          'Invalid email',
        );

        const persisted =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                user.id,
            },
          });

        expect(
          persisted.name,
        ).toBe(
          'FinPilot User Test',
        );
      },
    );

    test(
      'rejects changing the profile email to an email already registered',
      async () => {
        const firstUser =
          await createTestUser();

        const secondUser =
          await createTestUser();

        await expect(
          updateUserProfile({
            userId:
              firstUser.id,
            email:
              secondUser.email,
          }),
        ).rejects.toThrow(
          'Email already registered',
        );

        const persisted =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                firstUser.id,
            },
          });

        expect(
          persisted.email,
        ).toBe(
          firstUser.email,
        );
      },
    );

    test(
      'changes the password and stores a valid new password hash',
      async () => {
        const currentPassword =
          'CurrentPassword123!';

        const newPassword =
          'NewPassword456!';

        const user =
          await createTestUser({
            password:
              currentPassword,
          });

        const result =
          await changeUserPassword({
            userId:
              user.id,
            currentPassword,
            newPassword,
          });

        expect(
          result.message,
        ).toBe(
          'Password changed successfully',
        );

        const persisted =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                user.id,
            },
          });

        const newPasswordMatches =
          await bcrypt.compare(
            newPassword,
            persisted.passwordHash,
          );

        const oldPasswordMatches =
          await bcrypt.compare(
            currentPassword,
            persisted.passwordHash,
          );

        expect(
          newPasswordMatches,
        ).toBe(true);

        expect(
          oldPasswordMatches,
        ).toBe(false);
      },
    );

    test(
      'rejects an incorrect current password without changing the stored hash',
      async () => {
        const user =
          await createTestUser({
            password:
              'CorrectPassword123!',
          });

        const originalHash =
          user.passwordHash;

        await expect(
          changeUserPassword({
            userId:
              user.id,
            currentPassword:
              'WrongPassword123!',
            newPassword:
              'DifferentPassword456!',
          }),
        ).rejects.toThrow(
          'Current password is incorrect',
        );

        const persisted =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                user.id,
            },
          });

        expect(
          persisted.passwordHash,
        ).toBe(
          originalHash,
        );
      },
    );

    test(
      'validates password changes and rejects missing users',
      async () => {
        const currentPassword =
          'CurrentPassword123!';

        const user =
          await createTestUser({
            password:
              currentPassword,
          });

        await expect(
          changeUserPassword({
            userId:
              user.id,
            currentPassword:
              '',
            newPassword:
              'AnotherPassword123!',
          }),
        ).rejects.toThrow(
          'Current password is required',
        );

        await expect(
          changeUserPassword({
            userId:
              user.id,
            currentPassword,
            newPassword:
              'short',
          }),
        ).rejects.toThrow(
          'New password must contain at least 8 characters',
        );

        await expect(
          changeUserPassword({
            userId:
              user.id,
            currentPassword,
            newPassword:
              currentPassword,
          }),
        ).rejects.toThrow(
          'New password must be different from current password',
        );

        await expect(
          changeUserPassword({
            userId:
              randomUUID(),
            currentPassword:
              'SomePassword123!',
            newPassword:
              'AnotherPassword456!',
          }),
        ).rejects.toThrow(
          'User not found',
        );
      },
    );
  },
);