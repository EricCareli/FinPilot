import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';

export interface CreateGoalInput {
  workspaceId: string;
  name: string;
  targetAmount: number;
  deadline?: Date;
}

export interface UpdateGoalInput {
  workspaceId: string;
  goalId: string;
  name?: string;
  targetAmount?: number;
  deadline?: Date | null;
}

export interface UpdateGoalAmountInput {
  workspaceId: string;
  goalId: string;
  currentAmount: number;
}

export interface DeleteGoalInput {
  workspaceId: string;
  goalId: string;
}

function validateTargetAmount(
  targetAmount: number,
) {
  if (
    !Number.isFinite(targetAmount) ||
    targetAmount <= 0
  ) {
    throw new AppError(
      'Target amount must be greater than zero',
      400,
    );
  }
}

function validateDeadline(
  deadline: Date,
) {
  if (
    Number.isNaN(
      deadline.getTime(),
    )
  ) {
    throw new AppError(
      'Invalid deadline',
      400,
    );
  }
}

export async function createGoal(
  input: CreateGoalInput,
) {
  const name = input.name.trim();

  if (name.length < 2) {
    throw new AppError(
      'Goal name must contain at least 2 characters',
      400,
    );
  }

  validateTargetAmount(
    input.targetAmount,
  );

  if (input.deadline !== undefined) {
    validateDeadline(
      input.deadline,
    );
  }

  return prisma.goal.create({
    data: {
      workspaceId:
        input.workspaceId,
      name,
      targetAmount:
        new Prisma.Decimal(
          input.targetAmount,
        ),
      ...(input.deadline !== undefined
        ? {
            deadline:
              input.deadline,
          }
        : {}),
    },
  });
}

export async function listGoals(
  workspaceId: string,
) {
  return prisma.goal.findMany({
    where: {
      workspaceId,
    },
    orderBy: [
      {
        deadline: 'asc',
      },
      {
        createdAt: 'desc',
      },
    ],
  });
}

export async function getGoalProgress(
  workspaceId: string,
  goalId: string,
) {
  const goal =
    await prisma.goal.findFirst({
      where: {
        id: goalId,
        workspaceId,
      },
    });

  if (!goal) {
    throw new AppError(
      'Goal not found',
      404,
    );
  }

  const targetAmount =
    new Prisma.Decimal(
      goal.targetAmount,
    );

  const currentAmount =
    new Prisma.Decimal(
      goal.currentAmount,
    );

  const remaining =
    targetAmount.minus(
      currentAmount,
    );

  const percentage =
    targetAmount.isZero()
      ? new Prisma.Decimal(0)
      : currentAmount
          .div(targetAmount)
          .mul(100);

  const completed =
    currentAmount.greaterThanOrEqualTo(
      targetAmount,
    );

  return {
    goal,
    remaining:
      remaining.isNegative()
        ? new Prisma.Decimal(0)
        : remaining,
    percentage,
    completed,
  };
}

export async function updateGoal(
  input: UpdateGoalInput,
) {
  if (
    input.name === undefined &&
    input.targetAmount === undefined &&
    input.deadline === undefined
  ) {
    throw new AppError(
      'At least one goal field must be provided',
      400,
    );
  }

  const goal =
    await prisma.goal.findFirst({
      where: {
        id: input.goalId,
        workspaceId:
          input.workspaceId,
      },
    });

  if (!goal) {
    throw new AppError(
      'Goal not found',
      404,
    );
  }

  let normalizedName:
    | string
    | undefined;

  if (input.name !== undefined) {
    normalizedName =
      input.name.trim();

    if (
      normalizedName.length < 2
    ) {
      throw new AppError(
        'Goal name must contain at least 2 characters',
        400,
      );
    }
  }

  let normalizedTargetAmount:
    | Prisma.Decimal
    | undefined;

  if (
    input.targetAmount !== undefined
  ) {
    validateTargetAmount(
      input.targetAmount,
    );

    normalizedTargetAmount =
      new Prisma.Decimal(
        input.targetAmount,
      );
  }

  if (
    input.deadline instanceof Date
  ) {
    validateDeadline(
      input.deadline,
    );
  }

  return prisma.goal.update({
    where: {
      id: goal.id,
    },
    data: {
      ...(normalizedName !== undefined
        ? {
            name:
              normalizedName,
          }
        : {}),
      ...(normalizedTargetAmount !==
      undefined
        ? {
            targetAmount:
              normalizedTargetAmount,
          }
        : {}),
      ...(input.deadline !== undefined
        ? {
            deadline:
              input.deadline,
          }
        : {}),
    },
  });
}

export async function updateGoalAmount(
  input: UpdateGoalAmountInput,
) {
  if (
    !Number.isFinite(
      input.currentAmount,
    ) ||
    input.currentAmount < 0
  ) {
    throw new AppError(
      'Current amount must be greater than or equal to zero',
      400,
    );
  }

  const goal =
    await prisma.goal.findFirst({
      where: {
        id: input.goalId,
        workspaceId:
          input.workspaceId,
      },
    });

  if (!goal) {
    throw new AppError(
      'Goal not found',
      404,
    );
  }

  return prisma.goal.update({
    where: {
      id: goal.id,
    },
    data: {
      currentAmount:
        new Prisma.Decimal(
          input.currentAmount,
        ),
    },
  });
}

export async function deleteGoal(
  input: DeleteGoalInput,
) {
  const goal =
    await prisma.goal.findFirst({
      where: {
        id: input.goalId,
        workspaceId:
          input.workspaceId,
      },
    });

  if (!goal) {
    throw new AppError(
      'Goal not found',
      404,
    );
  }

  await prisma.goal.delete({
    where: {
      id: goal.id,
    },
  });

  return goal;
}