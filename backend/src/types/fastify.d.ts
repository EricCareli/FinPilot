import type { WorkspaceRole, Workspace } from '../generated/prisma/client.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub: string;
      email: string;
    };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    workspace: {
      id: string;
      name: string;
      type: Workspace['type'];
      role: WorkspaceRole;
    };
  }
}