import Fastify from 'fastify';

import {
  afterAll,
  describe,
  expect,
  test,
} from 'vitest';

import {
  prisma,
} from '../lib/prisma.js';

import {
  healthRoutes,
} from '../routes/health.routes.js';

import {
  checkDatabaseHealth,
} from '../services/health.service.js';

afterAll(
  async () => {
    await prisma.$disconnect();
  },
);

describe(
  'Health',
  () => {
    test(
      'reports the database as healthy when PostgreSQL is available',
      async () => {
        const databaseHealthy =
          await checkDatabaseHealth();

        expect(
          databaseHealthy,
        ).toBe(true);
      },
    );

    test(
      'returns a successful health response from the HTTP endpoint',
      async () => {
        const app =
          Fastify();

        await app.register(
          healthRoutes,
        );

        const response =
          await app.inject({
            method: 'GET',
            url: '/health',
          });

        expect(
          response.statusCode,
        ).toBe(200);

        expect(
          response.json(),
        ).toEqual({
          status: 'ok',
          service: 'finpilot-api',
          database: 'ok',
        });

        await app.close();
      },
    );
  },
);