import type { FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export async function getWorkspaceContext(
  request: FastifyRequest,
): Promise<void> {
  const workspaceId = request.headers['x-workspace-id'];

  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new AppError('Workspace ID is required', 400);
  }

  const userId = request.user.sub;

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    throw new AppError('Workspace access denied', 403);
  }

  request.workspace = {
    id: membership.workspace.id,
    name: membership.workspace.name,
    type: membership.workspace.type,
    role: membership.role,
  };
}