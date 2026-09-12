import {
  randomUUID,
} from 'node:crypto';

import bcrypt from 'bcryptjs';

import Fastify, {
  type FastifyInstance,
} from 'fastify';

import jwt from '@fastify/jwt';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

vi.mock(
  'node:crypto',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('node:crypto')
      >();

    return {
      ...actual,
      randomInt:
        vi.fn(() => 123456),
    };
  },
);

const {
  sendEmailChangeCodeMock,
} = vi.hoisted(() => ({
  sendEmailChangeCodeMock:
    vi.fn(),
}));

vi.mock(
  '../services/email.service.js',
  () => ({
    sendEmailChangeCode:
      sendEmailChangeCodeMock,
  }),
);

import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import { usersRoutes } from '../routes/users.routes.js';

const TEST_EMAIL_PREFIX =
  'finpilot_email_change_test_';

const TEST_PASSWORD =
  'FinPilot@Test123';

const TEST_JWT_SECRET =
  'finpilot-email-change-test-secret';

let app: FastifyInstance;

function createTestEmail() {
  return `${TEST_EMAIL_PREFIX}${randomUUID()}@example.com`;
}

async function createTestUser(
  options: {
    email?: string;
    password?: string;
  } = {},
) {
  const password =
    options.password ??
    TEST_PASSWORD;

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  return prisma.user.create({
    data: {
      name:
        'Email Change Test',
      email:
        options.email ??
        createTestEmail(),
      passwordHash,
      emailVerifiedAt:
        new Date(),
    },
  });
}

async function createToken(
  user: {
    id: string;
    email: string;
  },
) {
  return app.jwt.sign({
    sub: user.id,
    email: user.email,
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

async function buildTestApp() {
  const testApp =
    Fastify({
      logger: false,
    });

  testApp.setErrorHandler(
    (
      error,
      _request,
      reply,
    ) => {
      if (
        error instanceof AppError
      ) {
        return reply
          .status(
            error.statusCode,
          )
          .send({
            status: 'error',
            message:
              error.message,
          });
      }

      if (
        typeof error ===
          'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode ===
          'number' &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        const message =
          'message' in error &&
          typeof error.message ===
            'string'
            ? error.message
            : 'Request error';

        return reply
          .status(
            error.statusCode,
          )
          .send({
            status: 'error',
            message,
          });
      }

      return reply
        .status(500)
        .send({
          status: 'error',
          message:
            'Internal server error',
        });
    },
  );

  await testApp.register(
    jwt,
    {
      secret:
        TEST_JWT_SECRET,
      sign: {
        expiresIn: '1h',
      },
    },
  );

  await usersRoutes(
    testApp,
  );

  await testApp.ready();

  return testApp;
}

beforeAll(
  async () => {
    await cleanupTestData();

    app =
      await buildTestApp();
  },
);

afterEach(
  async () => {
    sendEmailChangeCodeMock
      .mockReset();

    await cleanupTestData();
  },
);

afterAll(
  async () => {
    await cleanupTestData();

    await app.close();

    await prisma.$disconnect();
  },
);

describe(
  'Email change',
  () => {
    test(
      'requests an email change without replacing the current email',
      async () => {
        const user =
          await createTestUser();

        const token =
          await createToken(
            user,
          );

        const newEmail =
          createTestEmail();

        const response =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail:
                `  ${newEmail.toUpperCase()}  `,
              currentPassword:
                TEST_PASSWORD,
            },
          });

        expect(
          response.statusCode,
        ).toBe(200);

        expect(
          response.json(),
        ).toMatchObject({
          status:
            'success',
          newEmail,
        });

        const persistedUser =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                user.id,
            },
          });

        expect(
          persistedUser.email,
        ).toBe(user.email);

        const verification =
          await prisma.emailChangeCode.findUnique({
            where: {
              userId:
                user.id,
            },
          });

        expect(
          verification,
        ).not.toBeNull();

        expect(
          verification?.newEmail,
        ).toBe(newEmail);

        expect(
          sendEmailChangeCodeMock,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          sendEmailChangeCodeMock,
        ).toHaveBeenCalledWith({
          email:
            newEmail,
          name:
            user.name,
          code:
            '123456',
        });
      },
    );

    test(
      'requires the current password to request an email change',
      async () => {
        const user =
          await createTestUser();

        const token =
          await createToken(
            user,
          );

        const response =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail:
                createTestEmail(),
              currentPassword:
                'WrongPassword123!',
            },
          });

        expect(
          response.statusCode,
        ).toBe(401);

        expect(
          response.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Current password is incorrect',
        });

        const verification =
          await prisma.emailChangeCode.findUnique({
            where: {
              userId:
                user.id,
            },
          });

        expect(
          verification,
        ).toBeNull();

        expect(
          sendEmailChangeCodeMock,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      'rejects the current email and an email already registered',
      async () => {
        const user =
          await createTestUser();

        const otherUser =
          await createTestUser();

        const token =
          await createToken(
            user,
          );

        const sameEmailResponse =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail:
                user.email,
              currentPassword:
                TEST_PASSWORD,
            },
          });

        expect(
          sameEmailResponse.statusCode,
        ).toBe(400);

        expect(
          sameEmailResponse.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'New email must be different from current email',
        });

        const duplicateEmailResponse =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail:
                otherUser.email,
              currentPassword:
                TEST_PASSWORD,
            },
          });

        expect(
          duplicateEmailResponse.statusCode,
        ).toBe(409);

        expect(
          duplicateEmailResponse.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Email already registered',
        });
      },
    );

    test(
      'enforces the resend cooldown for the same pending email',
      async () => {
        const user =
          await createTestUser();

        const token =
          await createToken(
            user,
          );

        const newEmail =
          createTestEmail();

        const firstResponse =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail,
              currentPassword:
                TEST_PASSWORD,
            },
          });

        expect(
          firstResponse.statusCode,
        ).toBe(200);

        const secondResponse =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail,
              currentPassword:
                TEST_PASSWORD,
            },
          });

        expect(
          secondResponse.statusCode,
        ).toBe(429);

        expect(
          sendEmailChangeCodeMock,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    test(
      'removes the pending verification when sending the email fails',
      async () => {
        const user =
          await createTestUser();

        const token =
          await createToken(
            user,
          );

        const newEmail =
          createTestEmail();

        sendEmailChangeCodeMock
          .mockRejectedValueOnce(
            new Error(
              'Email provider failed',
            ),
          );

        const response =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail,
              currentPassword:
                TEST_PASSWORD,
            },
          });

        expect(
          response.statusCode,
        ).toBe(500);

        expect(
          response.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Internal server error',
        });

        const verification =
          await prisma.emailChangeCode.findUnique({
            where: {
              userId:
                user.id,
            },
          });

        expect(
          verification,
        ).toBeNull();

        const persistedUser =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                user.id,
            },
          });

        expect(
          persistedUser.email,
        ).toBe(user.email);
      },
    );

    test(
      'verifies the code, changes the email and returns a refreshed JWT',
      async () => {
        const user =
          await createTestUser();

        const token =
          await createToken(
            user,
          );

        const newEmail =
          createTestEmail();

        const requestResponse =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail,
              currentPassword:
                TEST_PASSWORD,
            },
          });

        expect(
          requestResponse.statusCode,
        ).toBe(200);

        const verifyResponse =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/verify',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              code:
                '123456',
            },
          });

        expect(
          verifyResponse.statusCode,
        ).toBe(200);

        const body =
          verifyResponse.json() as {
            status: string;
            user: {
              id: string;
              name: string;
              email: string;
            };
            token: string;
          };

        expect(
          body.status,
        ).toBe('success');

        expect(
          body.user.email,
        ).toBe(newEmail);

        expect(
          body.token,
        ).toBeTruthy();

        const payload =
          app.jwt.verify<{
            sub: string;
            email: string;
          }>(
            body.token,
          );

        expect(
          payload.sub,
        ).toBe(user.id);

        expect(
          payload.email,
        ).toBe(newEmail);

        const persistedUser =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                user.id,
            },
          });

        expect(
          persistedUser.email,
        ).toBe(newEmail);

        expect(
          persistedUser.emailVerifiedAt,
        ).toBeInstanceOf(Date);

        const verification =
          await prisma.emailChangeCode.findUnique({
            where: {
              userId:
                user.id,
            },
          });

        expect(
          verification,
        ).toBeNull();
      },
    );

    test(
      'rejects an invalid verification code and keeps the current email',
      async () => {
        const user =
          await createTestUser();

        const token =
          await createToken(
            user,
          );

        const newEmail =
          createTestEmail();

        const requestResponse =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/request',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              newEmail,
              currentPassword:
                TEST_PASSWORD,
            },
          });

        expect(
          requestResponse.statusCode,
        ).toBe(200);

        const verifyResponse =
          await app.inject({
            method: 'POST',
            url:
              '/users/me/email-change/verify',
            headers: {
              authorization:
                `Bearer ${token}`,
            },
            payload: {
              code:
                '654321',
            },
          });

        expect(
          verifyResponse.statusCode,
        ).toBe(400);

        expect(
          verifyResponse.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Invalid verification code',
        });

        const persistedUser =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                user.id,
            },
          });

        expect(
          persistedUser.email,
        ).toBe(user.email);

        const verification =
          await prisma.emailChangeCode.findUniqueOrThrow({
            where: {
              userId:
                user.id,
            },
          });

        expect(
          verification.attempts,
        ).toBe(1);
      },
    );
  },
);
