import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.routes.js';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { AppError } from './errors/app-error.js';

// Porta padrão 3333, mas pode ser sobrescrita pela variável de ambiente PORT
const PORT = Number(process.env.PORT) || 3333;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured');
}

const jwtSecret: string = JWT_SECRET;

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler((error, request, reply) => {
  app.log.error(error);

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      status: 'error',
      message: error.message,
    });
  }

  return reply.status(500).send({
    status: 'error',
    message: 'Internal server error',
  });
});

  // Configuração do CORS
  await app.register(cors, {
    origin: true,
  });

await app.register(jwt, {
  secret: jwtSecret,
  sign: {
    expiresIn: '1h',
  },
});

  // Registro das rotas
  await healthRoutes(app);
await authRoutes(app);
await usersRoutes(app);

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({
      port: PORT,
      host: '0.0.0.0',
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();