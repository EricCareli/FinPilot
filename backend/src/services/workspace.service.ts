import type {
  WorkspaceRole,
  WorkspaceType,
} from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

interface CreateWorkspaceInput {
  userId: string;
  name: string;
  type: WorkspaceType;
}

interface UpdateWorkspaceInput {
  userId: string;
  workspaceId: string;
  name?: string;
  type?: WorkspaceType;
}

interface AddWorkspaceMemberInput {
  actorUserId: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
}

interface UpdateWorkspaceMemberRoleInput {
  actorUserId: string;
  workspaceId: string;
  memberId: string;
  role: WorkspaceRole;
}

interface RemoveWorkspaceMemberInput {
  actorUserId: string;
  workspaceId: string;
  memberId: string;
}

async function getMembership(
  userId: string,
  workspaceId: string,
) {
  const membership =
    await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

  if (!membership) {
    throw new AppError(
      'Workspace not found or access denied',
      404,
    );
  }

  return membership;
}

function ensureAdminPermission(
  role: WorkspaceRole,
) {
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new AppError(
      'Insufficient workspace permissions',
      403,
    );
  }
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
) {
  const name = input.name.trim();

  if (name.length < 2) {
    throw new AppError(
      'Workspace name must contain at least 2 characters',
      400,
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name,
        type: input.type,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: input.userId,
        role: 'OWNER',
      },
    });

    return {
      ...workspace,
      role: 'OWNER' as WorkspaceRole,
    };
  });
}

export async function listUserWorkspaces(
  userId: string,
) {
  const memberships =
    await prisma.workspaceMember.findMany({
      where: {
        userId,
      },
      include: {
        workspace: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

  return memberships.map((membership) => ({
    ...membership.workspace,
    role: membership.role,
  }));
}

export async function getWorkspace(
  userId: string,
  workspaceId: string,
) {
  const membership =
    await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
      include: {
        workspace: true,
      },
    });

  if (!membership) {
    throw new AppError(
      'Workspace not found or access denied',
      404,
    );
  }

  return {
    ...membership.workspace,
    role: membership.role,
  };
}

export async function updateWorkspace(
  input: UpdateWorkspaceInput,
) {
  const membership = await getMembership(
    input.userId,
    input.workspaceId,
  );

  ensureAdminPermission(membership.role);

  if (
    input.name === undefined &&
    input.type === undefined
  ) {
    throw new AppError(
      'At least one workspace field must be provided',
      400,
    );
  }

  let normalizedName: string | undefined;

  if (input.name !== undefined) {
    normalizedName = input.name.trim();

    if (normalizedName.length < 2) {
      throw new AppError(
        'Workspace name must contain at least 2 characters',
        400,
      );
    }
  }

  if (input.type === 'PERSONAL') {
    const memberCount =
      await prisma.workspaceMember.count({
        where: {
          workspaceId: input.workspaceId,
        },
      });

    if (memberCount > 1) {
      throw new AppError(
        'A workspace with multiple members cannot be changed to PERSONAL',
        400,
      );
    }
  }

  return prisma.workspace.update({
    where: {
      id: input.workspaceId,
    },
    data: {
      ...(normalizedName !== undefined
        ? { name: normalizedName }
        : {}),
      ...(input.type !== undefined
        ? { type: input.type }
        : {}),
    },
  });
}

export async function listWorkspaceMembers(
  userId: string,
  workspaceId: string,
) {
  await getMembership(userId, workspaceId);

  return prisma.workspaceMember.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

export async function addWorkspaceMember(
  input: AddWorkspaceMemberInput,
) {
  const actorMembership = await getMembership(
    input.actorUserId,
    input.workspaceId,
  );

  ensureAdminPermission(actorMembership.role);

  if (
    actorMembership.role !== 'OWNER' &&
    input.role === 'OWNER'
  ) {
    throw new AppError(
      'Only an owner can add another owner',
      403,
    );
  }

  const workspace =
    await prisma.workspace.findUnique({
      where: {
        id: input.workspaceId,
      },
    });

  if (!workspace) {
    throw new AppError('Workspace not found', 404);
  }

  if (workspace.type === 'PERSONAL') {
    throw new AppError(
      'Personal workspaces cannot have additional members',
      400,
    );
  }

  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new AppError(
      'User with this email was not found',
      404,
    );
  }

  const existingMember =
    await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: input.workspaceId,
        userId: user.id,
      },
    });

  if (existingMember) {
    throw new AppError(
      'User is already a workspace member',
      409,
    );
  }

  return prisma.workspaceMember.create({
    data: {
      workspaceId: input.workspaceId,
      userId: user.id,
      role: input.role,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function updateWorkspaceMemberRole(
  input: UpdateWorkspaceMemberRoleInput,
) {
  const actorMembership = await getMembership(
    input.actorUserId,
    input.workspaceId,
  );

  ensureAdminPermission(actorMembership.role);

  const targetMembership =
    await prisma.workspaceMember.findFirst({
      where: {
        id: input.memberId,
        workspaceId: input.workspaceId,
      },
    });

  if (!targetMembership) {
    throw new AppError(
      'Workspace member not found',
      404,
    );
  }

  if (
    actorMembership.role !== 'OWNER' &&
    (targetMembership.role === 'OWNER' ||
      input.role === 'OWNER')
  ) {
    throw new AppError(
      'Only an owner can manage owner roles',
      403,
    );
  }

  if (
    targetMembership.role === 'OWNER' &&
    input.role !== 'OWNER'
  ) {
    const ownerCount =
      await prisma.workspaceMember.count({
        where: {
          workspaceId: input.workspaceId,
          role: 'OWNER',
        },
      });

    if (ownerCount <= 1) {
      throw new AppError(
        'The last workspace owner cannot be downgraded',
        400,
      );
    }
  }

  return prisma.workspaceMember.update({
    where: {
      id: targetMembership.id,
    },
    data: {
      role: input.role,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function removeWorkspaceMember(
  input: RemoveWorkspaceMemberInput,
) {
  const actorMembership = await getMembership(
    input.actorUserId,
    input.workspaceId,
  );

  ensureAdminPermission(actorMembership.role);

  const targetMembership =
    await prisma.workspaceMember.findFirst({
      where: {
        id: input.memberId,
        workspaceId: input.workspaceId,
      },
    });

  if (!targetMembership) {
    throw new AppError(
      'Workspace member not found',
      404,
    );
  }

  if (
    actorMembership.role !== 'OWNER' &&
    targetMembership.role === 'OWNER'
  ) {
    throw new AppError(
      'Only an owner can remove another owner',
      403,
    );
  }

  if (targetMembership.role === 'OWNER') {
    const ownerCount =
      await prisma.workspaceMember.count({
        where: {
          workspaceId: input.workspaceId,
          role: 'OWNER',
        },
      });

    if (ownerCount <= 1) {
      throw new AppError(
        'The last workspace owner cannot be removed',
        400,
      );
    }
  }

  await prisma.workspaceMember.delete({
    where: {
      id: targetMembership.id,
    },
  });

  return {
    id: targetMembership.id,
    userId: targetMembership.userId,
    workspaceId: targetMembership.workspaceId,
  };
}