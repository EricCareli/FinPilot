import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export interface CreateGoalInput {
  workspaceId: string;
  name: string;
  targetAmount: number;
  deadline?: Date;
}

export interface UpdateGoalAmountInput {
  workspaceId: string;
  goalId: string;
  currentAmount: number;
}

export async function createGoal(
  input: CreateGoalInput,
) {
  const name = input.name.trim();

  if (name.length < 2) {
    throw new Error(
      'Goal name must contain at least 2 characters',
    );
  }

  if (
    !Number.isFinite(input.targetAmount) ||
    input.targetAmount <= 0
  ) {
    throw new Error(
      'Target amount must be greater than zero',
    );
  }

  if (
    input.deadline &&
    Number.isNaN(input.deadline.getTime())
  ) {
    throw new Error('Invalid deadline');
  }

  return prisma.goal.create({
    data: {
      workspaceId: input.workspaceId,
      name,
      targetAmount: input.targetAmount,
      ...(input.deadline
        ? { deadline: input.deadline }
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
  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      workspaceId,
    },
  });

  if (!goal) {
    throw new Error('Goal not found');
  }

  const targetAmount = new Prisma.Decimal(
    goal.targetAmount,
  );

  const currentAmount = new Prisma.Decimal(
    goal.currentAmount,
  );

  const remaining = targetAmount.minus(
    currentAmount,
  );

  const percentage = targetAmount.isZero()
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

export async function updateGoalAmount(
  input: UpdateGoalAmountInput,
) {
  if (
    !Number.isFinite(input.currentAmount) ||
    input.currentAmount < 0
  ) {
    throw new Error(
      'Current amount must be greater than or equal to zero',
    );
  }

  const goal = await prisma.goal.findFirst({
    where: {
      id: input.goalId,
      workspaceId: input.workspaceId,
    },
  });

  if (!goal) {
    throw new Error('Goal not found');
  }

  return prisma.goal.update({
    where: {
      id: goal.id,
    },
    data: {
      currentAmount: input.currentAmount,
    },
  });
}