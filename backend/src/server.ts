import Fastify from 'fastify';
import cors from '@fastify/cors';

// Porta padrão 3333, mas pode ser sobrescrita pela variável de ambiente PORT
const PORT = Number(process.env.PORT) || 3333;

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  // Configuração do CORS. Nesta primeira versão, liberamos todas as origens.
  // Em produção, isso deve ser restringido aos domínios do front-end do FinPilot.
  await app.register(cors, {
    origin: true,
  });

  // Rota de healthcheck: usada para verificar se a API está de pé
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'finpilot-api',
    };
  });

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();