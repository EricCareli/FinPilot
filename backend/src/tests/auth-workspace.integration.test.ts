import { randomUUID } from 'node:crypto';

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
} from 'vitest';

import { prisma } from '../lib/prisma.js';

import { AppError } from '../errors/app-error.js';

import {
  authenticate,
} from '../middlewares/auth.middleware.js';

import {
  workspaceMiddleware,
} from '../middlewares/workspace.middleware.js';

import {
  requireWorkspaceRoles,
} from '../middlewares/permission.middleware.js';

import {
  authRoutes,
} from '../routes/auth.routes.js';

import {
  workspacesRoutes,
} from '../routes/workspaces.routes.js';

const TEST_PREFIX =
  'finpilot.vitest.auth.';

const TEST_PASSWORD =
  'FinPilot@Test123';

const TEST_JWT_SECRET =
  'finpilot-vitest-jwt-secret';

interface TestUser {
  id: string;
  name: string;
  email: string;
}

interface LoginResult {
  user: TestUser;
  token: string;
}

let app: FastifyInstance;

function createTestEmail() {
  return `${TEST_PREFIX}${randomUUID()}@example.com`;
}

async function cleanupTestData() {
  const users =
    await prisma.user.findMany({
      where: {
        email: {
          startsWith:
            TEST_PREFIX,
        },
      },
      select: {
        id: true,
      },
    });

  if (
    users.length === 0
  ) {
    return;
  }

  const userIds =
    users.map(
      (user) =>
        user.id,
    );

  const memberships =
    await prisma.workspaceMember.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      select: {
        workspaceId: true,
      },
    });

  const workspaceIds = [
    ...new Set(
      memberships.map(
        (membership) =>
          membership.workspaceId,
      ),
    ),
  ];

  await prisma.workspaceMember.deleteMany({
    where: {
      userId: {
        in: userIds,
      },
    },
  });

  if (
    workspaceIds.length > 0
  ) {
    await prisma.workspaceMember.deleteMany({
      where: {
        workspaceId: {
          in: workspaceIds,
        },
      },
    });

    await prisma.workspace.deleteMany({
      where: {
        id: {
          in: workspaceIds,
        },
      },
    });
  }

  await prisma.user.deleteMany({
    where: {
      id: {
        in: userIds,
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

  await authRoutes(
    testApp,
  );

  await workspacesRoutes(
    testApp,
  );

  /*
   * Rota exclusiva da suíte
   * para testar autenticação +
   * workspaceMiddleware.
   */
  testApp.get(
    '/test/workspace-context',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
      ],
    },
    async (
      request,
      reply,
    ) => {
      return reply
        .status(200)
        .send({
          status:
            'success',
          workspace:
            request.workspace,
        });
    },
  );

  /*
   * Simula uma operação financeira
   * protegida pelas mesmas roles
   * usadas no backend.
   */
  testApp.post(
    '/test/finance-action',
    {
      preHandler: [
        authenticate,
        workspaceMiddleware,
        requireWorkspaceRoles(
          'OWNER',
          'ADMIN',
          'FINANCE',
        ),
      ],
    },
    async (
      request,
      reply,
    ) => {
      return reply
        .status(200)
        .send({
          status:
            'success',
          role:
            request.workspace
              .role,
        });
    },
  );

  await testApp.ready();

  return testApp;
}

async function registerUser(
  name: string,
  email = createTestEmail(),
) {
  const response =
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name,
        email,
        password:
          TEST_PASSWORD,
      },
    });

  expect(
    response.statusCode,
  ).toBe(201);

  const body =
    response.json() as {
      status: string;
      user: TestUser;
    };

  expect(
    body.status,
  ).toBe('success');

  return body.user;
}

async function loginUser(
  email: string,
  password =
    TEST_PASSWORD,
): Promise<LoginResult> {
  const response =
    await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email,
        password,
      },
    });

  expect(
    response.statusCode,
  ).toBe(200);

  const body =
    response.json() as {
      status: string;
      user: TestUser;
      token: string;
    };

  expect(
    body.status,
  ).toBe('success');

  expect(
    body.token,
  ).toBeTruthy();

  return {
    user: body.user,
    token: body.token,
  };
}

async function createUserAndLogin(
  name: string,
) {
  const email =
    createTestEmail();

  const user =
    await registerUser(
      name,
      email,
    );

  const login =
    await loginUser(
      email,
    );

  return {
    user,
    email,
    token:
      login.token,
  };
}

async function createBusinessWorkspace(
  token: string,
) {
  const response =
    await app.inject({
      method: 'POST',
      url: '/workspaces',
      headers: {
        authorization:
          `Bearer ${token}`,
      },
      payload: {
        name:
          'FinPilot Vitest Business',
        type:
          'BUSINESS',
      },
    });

  expect(
    response.statusCode,
  ).toBe(201);

  const body =
    response.json() as {
      status: string;
      workspace: {
        id: string;
        name: string;
        type: string;
        role: string;
      };
    };

  expect(
    body.workspace.role,
  ).toBe('OWNER');

  return body.workspace;
}

async function addMember(
  workspaceId: string,
  ownerToken: string,
  email: string,
  role:
    | 'ADMIN'
    | 'FINANCE'
    | 'VIEWER',
) {
  const response =
    await app.inject({
      method: 'POST',
      url:
        `/workspaces/${workspaceId}/members`,
      headers: {
        authorization:
          `Bearer ${ownerToken}`,
      },
      payload: {
        email,
        role,
      },
    });

  expect(
    response.statusCode,
  ).toBe(201);

  return response.json();
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
  'Authentication and workspace security',
  () => {
    test(
      'registers a user and automatically creates a personal OWNER workspace',
      async () => {
        const email =
          createTestEmail();

        const user =
          await registerUser(
            'Vitest Owner',
            email,
          );

        expect(
          user.email,
        ).toBe(email);

        const membership =
          await prisma.workspaceMember.findFirst({
            where: {
              userId:
                user.id,
            },
            include: {
              workspace:
                true,
            },
          });

        expect(
          membership,
        ).not.toBeNull();

        expect(
          membership?.role,
        ).toBe('OWNER');

        expect(
          membership
            ?.workspace
            .name,
        ).toBe('Personal');

        expect(
          membership
            ?.workspace
            .type,
        ).toBe('PERSONAL');
      },
    );

    test(
      'logs in and generates a valid JWT containing sub and email',
      async () => {
        const email =
          createTestEmail();

        const user =
          await registerUser(
            'JWT User',
            email,
          );

        const login =
          await loginUser(
            email,
          );

        const payload =
          app.jwt.verify<{
            sub: string;
            email: string;
          }>(
            login.token,
          );

        expect(
          payload.sub,
        ).toBe(user.id);

        expect(
          payload.email,
        ).toBe(email);
      },
    );

    test(
      'rejects login with an invalid password',
      async () => {
        const email =
          createTestEmail();

        await registerUser(
          'Invalid Password',
          email,
        );

        const response =
          await app.inject({
            method:
              'POST',
            url:
              '/auth/login',
            payload: {
              email,
              password:
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
            'Invalid email or password',
        });
      },
    );

    test(
      'rejects protected routes without a token or with an invalid token',
      async () => {
        const withoutToken =
          await app.inject({
            method: 'GET',
            url:
              '/test/workspace-context',
          });

        expect(
          withoutToken.statusCode,
        ).toBe(401);

        expect(
          withoutToken.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Unauthorized',
        });

        const invalidToken =
          await app.inject({
            method: 'GET',
            url:
              '/test/workspace-context',
            headers: {
              authorization:
                'Bearer token-invalido',
            },
          });

        expect(
          invalidToken.statusCode,
        ).toBe(401);

        expect(
          invalidToken.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Unauthorized',
        });
      },
    );

    test(
      'allows access to own workspace and denies another user',
      async () => {
        const owner =
          await createUserAndLogin(
            'Workspace Owner',
          );

        const outsider =
          await createUserAndLogin(
            'Workspace Outsider',
          );

        const ownerMembership =
          await prisma.workspaceMember.findFirstOrThrow({
            where: {
              userId:
                owner.user.id,
              role:
                'OWNER',
            },
          });

        const ownAccess =
          await app.inject({
            method: 'GET',
            url:
              '/test/workspace-context',
            headers: {
              authorization:
                `Bearer ${owner.token}`,
              'x-workspace-id':
                ownerMembership.workspaceId,
            },
          });

        expect(
          ownAccess.statusCode,
        ).toBe(200);

        expect(
          ownAccess.json(),
        ).toMatchObject({
          status:
            'success',
          workspace: {
            id:
              ownerMembership.workspaceId,
            role:
              'OWNER',
          },
        });

        const denied =
          await app.inject({
            method: 'GET',
            url:
              '/test/workspace-context',
            headers: {
              authorization:
                `Bearer ${outsider.token}`,
              'x-workspace-id':
                ownerMembership.workspaceId,
            },
          });

        expect(
          denied.statusCode,
        ).toBe(403);

        expect(
          denied.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Workspace access denied',
        });
      },
    );

    test(
      'hides a foreign workspace from the workspace details endpoint',
      async () => {
        const owner =
          await createUserAndLogin(
            'Hidden Workspace Owner',
          );

        const outsider =
          await createUserAndLogin(
            'Hidden Workspace Outsider',
          );

        const workspace =
          await createBusinessWorkspace(
            owner.token,
          );

        const response =
          await app.inject({
            method: 'GET',
            url:
              `/workspaces/${workspace.id}`,
            headers: {
              authorization:
                `Bearer ${outsider.token}`,
            },
          });

        expect(
          response.statusCode,
        ).toBe(404);

        expect(
          response.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Workspace not found or access denied',
        });
      },
    );

    test(
      'allows OWNER, ADMIN and FINANCE financial access but blocks VIEWER',
      async () => {
        const owner =
          await createUserAndLogin(
            'Role Owner',
          );

        const admin =
          await createUserAndLogin(
            'Role Admin',
          );

        const finance =
          await createUserAndLogin(
            'Role Finance',
          );

        const viewer =
          await createUserAndLogin(
            'Role Viewer',
          );

        const workspace =
          await createBusinessWorkspace(
            owner.token,
          );

        await addMember(
          workspace.id,
          owner.token,
          admin.email,
          'ADMIN',
        );

        await addMember(
          workspace.id,
          owner.token,
          finance.email,
          'FINANCE',
        );

        await addMember(
          workspace.id,
          owner.token,
          viewer.email,
          'VIEWER',
        );

        const allowedUsers = [
          {
            role:
              'OWNER',
            token:
              owner.token,
          },
          {
            role:
              'ADMIN',
            token:
              admin.token,
          },
          {
            role:
              'FINANCE',
            token:
              finance.token,
          },
        ];

        for (
          const allowedUser of
            allowedUsers
        ) {
          const response =
            await app.inject({
              method:
                'POST',
              url:
                '/test/finance-action',
              headers: {
                authorization:
                  `Bearer ${allowedUser.token}`,
                'x-workspace-id':
                  workspace.id,
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
            role:
              allowedUser.role,
          });
        }

        const viewerResponse =
          await app.inject({
            method: 'POST',
            url:
              '/test/finance-action',
            headers: {
              authorization:
                `Bearer ${viewer.token}`,
              'x-workspace-id':
                workspace.id,
            },
          });

        expect(
          viewerResponse.statusCode,
        ).toBe(403);

        expect(
          viewerResponse.json(),
        ).toMatchObject({
          status:
            'error',
          message:
            'Insufficient workspace permissions',
        });
      },
    );
  },
);