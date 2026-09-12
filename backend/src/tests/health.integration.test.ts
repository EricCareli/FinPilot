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
  getApplicationHealth,
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
        const databaseHealth =
          await checkDatabaseHealth();

        expect(
          databaseHealth.status,
        ).toBe('ok');

        expect(
          databaseHealth.latencyMs,
        ).toEqual(
          expect.any(Number),
        );

        expect(
          databaseHealth.latencyMs,
        ).toBeGreaterThanOrEqual(
          0,
        );
      },
    );

    test(
      'returns application health metadata',
      () => {
        const applicationHealth =
          getApplicationHealth();

        expect(
          applicationHealth,
        ).toMatchObject({
          service:
            'finpilot-api',
          environment:
            process.env.NODE_ENV ??
            'development',
        });

        expect(
          applicationHealth.timestamp,
        ).toEqual(
          expect.any(String),
        );

        expect(
          applicationHealth.uptimeSeconds,
        ).toEqual(
          expect.any(Number),
        );
      },
    );

    test(
      'returns a successful liveness response',
      async () => {
        const app =
          Fastify();

        await app.register(
          healthRoutes,
        );

        const response =
          await app.inject({
            method: 'GET',
            url:
              '/health/live',
          });

        expect(
          response.statusCode,
        ).toBe(200);

        const body =
          response.json();

        expect(
          body,
        ).toMatchObject({
          status: 'ok',
          service:
            'finpilot-api',
          environment:
            'test',
        });

        expect(
          body.timestamp,
        ).toEqual(
          expect.any(String),
        );

        expect(
          body.uptimeSeconds,
        ).toEqual(
          expect.any(Number),
        );

        await app.close();
      },
    );

    test(
      'returns a successful readiness response when PostgreSQL is available',
      async () => {
        const app =
          Fastify();

        await app.register(
          healthRoutes,
        );

        const response =
          await app.inject({
            method: 'GET',
            url:
              '/health/ready',
          });

        expect(
          response.statusCode,
        ).toBe(200);

        const body =
          response.json();

        expect(
          body,
        ).toMatchObject({
          status: 'ok',
          service:
            'finpilot-api',
          environment:
            'test',

          checks: {
            database: {
              status: 'ok',
            },
          },
        });

        expect(
          body.timestamp,
        ).toEqual(
          expect.any(String),
        );

        expect(
          body.uptimeSeconds,
        ).toEqual(
          expect.any(Number),
        );

        expect(
          body.checks.database
            .latencyMs,
        ).toEqual(
          expect.any(Number),
        );

        await app.close();
      },
    );

    test(
      'keeps the main health endpoint compatible with the complete health response',
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

        const body =
          response.json();

        expect(
          body,
        ).toMatchObject({
          status: 'ok',
          service:
            'finpilot-api',
          environment:
            'test',

          checks: {
            database: {
              status: 'ok',
            },
          },
        });

        expect(
          body.timestamp,
        ).toEqual(
          expect.any(String),
        );

        expect(
          body.uptimeSeconds,
        ).toEqual(
          expect.any(Number),
        );

        expect(
          body.checks.database
            .latencyMs,
        ).toEqual(
          expect.any(Number),
        );

        await app.close();
      },
    );
  },
);
