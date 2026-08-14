import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.routes.js';

// Porta padrão 3333, mas pode ser sobrescrita pela variável de ambiente PORT
const PORT = Number(process.env.PORT) || 3333;

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  // Configuração do CORS
  await app.register(cors, {
    origin: true,
  });

  // Registro das rotas
  await healthRoutes(app);

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