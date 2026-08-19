import type { FastifyReply, FastifyRequest } from 'fastify';
import type { WorkspaceRole } from '../generated/prisma/client.js';
import { AppError } from '../errors/app-error.js';

export function requireWorkspaceRoles(
  ...allowedRoles: WorkspaceRole[]
) {
  return async (
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> => {
    const role = request.workspace.role;

    if (!allowedRoles.includes(role)) {
      throw new AppError('Insufficient workspace permissions', 403);
    }
  };
}