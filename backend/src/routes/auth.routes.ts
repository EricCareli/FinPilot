import type { FastifyInstance } from 'fastify';
import { loginUser, registerUser } from '../services/auth.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (request, reply) => {
    const { name, email, password } = request.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      return reply.status(400).send({
        status: 'error',
        message: 'Name, email and password are required',
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2) {
      return reply.status(400).send({
        status: 'error',
        message: 'Name must contain at least 2 characters',
      });
    }

    if (!normalizedEmail.includes('@')) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid email',
      });
    }

    if (password.length < 8) {
      return reply.status(400).send({
        status: 'error',
        message: 'Password must contain at least 8 characters',
      });
    }

    try {
      const user = await registerUser({
        name: normalizedName,
        email: normalizedEmail,
        password,
      });

      return reply.status(201).send({
        status: 'success',
        user,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'EMAIL_ALREADY_EXISTS') {
        return reply.status(409).send({
          status: 'error',
          message: 'Email already registered',
        });
      }

      app.log.error(error);

      return reply.status(500).send({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return reply.status(400).send({
        status: 'error',
        message: 'Email and password are required',
      });
    }

    try {
      const user = await loginUser({
        email,
        password,
      });

      const token = await app.jwt.sign({
        sub: user.id,
        email: user.email,
      });

      return reply.status(200).send({
        status: 'success',
        user,
        token,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        return reply.status(401).send({
          status: 'error',
          message: 'Invalid email or password',
        });
      }

      app.log.error(error);

      return reply.status(500).send({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });
}