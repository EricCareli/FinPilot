import { prisma } from '../lib/prisma.js';

export type HealthStatus =
  | 'ok'
  | 'unavailable';

export interface DatabaseHealth {
  status: HealthStatus;
  latencyMs: number;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startedAt =
    performance.now();

  try {
    await prisma.$queryRaw`
      SELECT 1
    `;

    const latencyMs =
      Math.round(
        performance.now() -
          startedAt,
      );

    return {
      status: 'ok',
      latencyMs,
    };
  } catch {
    const latencyMs =
      Math.round(
        performance.now() -
          startedAt,
      );

    return {
      status: 'unavailable',
      latencyMs,
    };
  }
}

export function getApplicationHealth() {
  return {
    service:
      'finpilot-api',
    timestamp:
      new Date().toISOString(),
    uptimeSeconds:
      Math.floor(
        process.uptime(),
      ),
    environment:
      process.env.NODE_ENV ??
      'development',
  };
}