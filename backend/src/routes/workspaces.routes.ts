import type { FastifyInstance } from 'fastify';
import type {
  WorkspaceRole,
  WorkspaceType,
} from '../generated/prisma/client.js';

import { authenticate } from '../middlewares/auth.middleware.js';

import {
  addWorkspaceMember,
  createWorkspace,
  getWorkspace,
  listUserWorkspaces,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMemberRole,
} from '../services/workspace.service.js';

const workspaceTypes = [
  'PERSONAL',
  'BUSINESS',
] as const;

const workspaceRoles = [
  'OWNER',
  'ADMIN',
  'FINANCE',
  'VIEWER',
] as const;

function isWorkspaceType(
  value: string,
): value is WorkspaceType {
  return workspaceTypes.some(
    (type) => type === value,
  );
}

function isWorkspaceRole(
  value: string,
): value is WorkspaceRole {
  return workspaceRoles.some(
    (role) => role === value,
  );
}

export async function workspacesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/workspaces',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { name, type } = request.body as {
        name?: string;
        type?: string;
      };

      if (!name || !type) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Workspace name and type are required',
        });
      }

      if (!isWorkspaceType(type)) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Workspace type must be PERSONAL or BUSINESS',
        });
      }

      const workspace = await createWorkspace({
        userId: request.user.sub,
        name,
        type,
      });

      return reply.status(201).send({
        status: 'success',
        workspace,
      });
    },
  );

  app.get(
    '/workspaces',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const workspaces =
        await listUserWorkspaces(
          request.user.sub,
        );

      return reply.status(200).send({
        status: 'success',
        workspaces,
      });
    },
  );

  app.get(
    '/workspaces/:workspaceId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { workspaceId } =
        request.params as {
          workspaceId: string;
        };

      const workspace = await getWorkspace(
        request.user.sub,
        workspaceId,
      );

      return reply.status(200).send({
        status: 'success',
        workspace,
      });
    },
  );

  app.patch(
    '/workspaces/:workspaceId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { workspaceId } =
        request.params as {
          workspaceId: string;
        };

      const { name, type } = request.body as {
        name?: string;
        type?: string;
      };

      let normalizedType:
        | WorkspaceType
        | undefined;

      if (type !== undefined) {
        if (!isWorkspaceType(type)) {
          return reply.status(400).send({
            status: 'error',
            message:
              'Workspace type must be PERSONAL or BUSINESS',
          });
        }

        normalizedType = type;
      }

      const workspace = await updateWorkspace({
        userId: request.user.sub,
        workspaceId,
        ...(name !== undefined
          ? { name }
          : {}),
        ...(normalizedType !== undefined
          ? { type: normalizedType }
          : {}),
      });

      return reply.status(200).send({
        status: 'success',
        workspace,
      });
    },
  );

  app.get(
    '/workspaces/:workspaceId/members',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { workspaceId } =
        request.params as {
          workspaceId: string;
        };

      const members =
        await listWorkspaceMembers(
          request.user.sub,
          workspaceId,
        );

      return reply.status(200).send({
        status: 'success',
        members,
      });
    },
  );

  app.post(
    '/workspaces/:workspaceId/members',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { workspaceId } =
        request.params as {
          workspaceId: string;
        };

      const { email, role } = request.body as {
        email?: string;
        role?: string;
      };

      if (!email || !role) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Member email and role are required',
        });
      }

      if (!email.includes('@')) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid email',
        });
      }

      if (!isWorkspaceRole(role)) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid workspace role',
        });
      }

      const member = await addWorkspaceMember({
        actorUserId: request.user.sub,
        workspaceId,
        email,
        role,
      });

      return reply.status(201).send({
        status: 'success',
        member,
      });
    },
  );

  app.patch(
    '/workspaces/:workspaceId/members/:memberId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { workspaceId, memberId } =
        request.params as {
          workspaceId: string;
          memberId: string;
        };

      const { role } = request.body as {
        role?: string;
      };

      if (!role) {
        return reply.status(400).send({
          status: 'error',
          message: 'Role is required',
        });
      }

      if (!isWorkspaceRole(role)) {
        return reply.status(400).send({
          status: 'error',
          message:
            'Invalid workspace role',
        });
      }

      const member =
        await updateWorkspaceMemberRole({
          actorUserId: request.user.sub,
          workspaceId,
          memberId,
          role,
        });

      return reply.status(200).send({
        status: 'success',
        member,
      });
    },
  );

  app.delete(
    '/workspaces/:workspaceId/members/:memberId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { workspaceId, memberId } =
        request.params as {
          workspaceId: string;
          memberId: string;
        };

      const removedMember =
        await removeWorkspaceMember({
          actorUserId: request.user.sub,
          workspaceId,
          memberId,
        });

      return reply.status(200).send({
        status: 'success',
        removedMember,
      });
    },
  );
}