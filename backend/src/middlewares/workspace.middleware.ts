import type { FastifyReply, FastifyRequest } from 'fastify';
import { getWorkspaceContext } from '../context/workspace-context.js';

export async function workspaceMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  await getWorkspaceContext(request);
}