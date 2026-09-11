import { randomUUID } from 'node:crypto';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'vitest';

import {
  prisma,
} from '../lib/prisma.js';

import {
  createGoal,
  deleteGoal,
  getGoalProgress,
  listGoals,
  updateGoal,
  updateGoalAmount,
} from '../services/goal.service.js';

const TEST_PREFIX =
  'FINPILOT_GOAL_TEST_';

async function createTestWorkspace() {
  return prisma.workspace.create({
    data: {
      name:
        `${TEST_PREFIX}${randomUUID()}`,
      type: 'BUSINESS',
    },
  });
}

async function cleanupTestData() {
  const workspaces =
    await prisma.workspace.findMany({
      where: {
        name: {
          startsWith:
            TEST_PREFIX,
        },
      },
      select: {
        id: true,
      },
    });

  if (
    workspaces.length === 0
  ) {
    return;
  }

  const workspaceIds =
    workspaces.map(
      (workspace) =>
        workspace.id,
    );

  await prisma.goal.deleteMany({
    where: {
      workspaceId: {
        in: workspaceIds,
      },
    },
  });

  await prisma.workspace.deleteMany({
    where: {
      id: {
        in: workspaceIds,
      },
    },
  });
}

beforeAll(
  async () => {
    await cleanupTestData();
  },
);

afterEach(
  async () => {
    await cleanupTestData();
  },
);

afterAll(
  async () => {
    await cleanupTestData();

    await prisma.$disconnect();
  },
);

describe(
  'Goals',
  () => {
    test(
      'creates a goal with zero current amount and optional deadline',
      async () => {
        const workspace =
          await createTestWorkspace();

        const deadline =
          new Date(
            '2027-12-31T00:00:00.000Z',
          );

        const goal =
          await createGoal({
            workspaceId:
              workspace.id,
            name:
              'Reserva de emergência',
            targetAmount:
              50000,
            deadline,
          });

        expect(
          goal.workspaceId,
        ).toBe(workspace.id);

        expect(
          goal.name,
        ).toBe(
          'Reserva de emergência',
        );

        expect(
          goal.targetAmount.toString(),
        ).toBe('50000');

        expect(
          goal.currentAmount.toString(),
        ).toBe('0');

        expect(
          goal.deadline?.toISOString(),
        ).toBe(
          deadline.toISOString(),
        );
      },
    );

    test(
      'creates a goal without a deadline',
      async () => {
        const workspace =
          await createTestWorkspace();

        const goal =
          await createGoal({
            workspaceId:
              workspace.id,
            name:
              'Comprar carro',
            targetAmount:
              80000,
          });

        expect(
          goal.name,
        ).toBe('Comprar carro');

        expect(
          goal.deadline,
        ).toBeNull();

        expect(
          goal.currentAmount.toString(),
        ).toBe('0');
      },
    );

    test(
      'validates goal name target amount and deadline',
      async () => {
        const workspace =
          await createTestWorkspace();

        await expect(
          createGoal({
            workspaceId:
              workspace.id,
            name:
              'A',
            targetAmount:
              1000,
          }),
        ).rejects.toThrow(
          'Goal name must contain at least 2 characters',
        );

        await expect(
          createGoal({
            workspaceId:
              workspace.id,
            name:
              'Meta inválida',
            targetAmount:
              0,
          }),
        ).rejects.toThrow(
          'Target amount must be greater than zero',
        );

        await expect(
          createGoal({
            workspaceId:
              workspace.id,
            name:
              'Meta com data inválida',
            targetAmount:
              1000,
            deadline:
              new Date(
                'invalid-date',
              ),
          }),
        ).rejects.toThrow(
          'Invalid deadline',
        );

        const goalCount =
          await prisma.goal.count({
            where: {
              workspaceId:
                workspace.id,
            },
          });

        expect(
          goalCount,
        ).toBe(0);
      },
    );

    test(
      'lists only goals from the selected workspace',
      async () => {
        const workspaceA =
          await createTestWorkspace();

        const workspaceB =
          await createTestWorkspace();

        await createGoal({
          workspaceId:
            workspaceA.id,
          name:
            'Meta A 1',
          targetAmount:
            1000,
        });

        await createGoal({
          workspaceId:
            workspaceA.id,
          name:
            'Meta A 2',
          targetAmount:
            2000,
        });

        await createGoal({
          workspaceId:
            workspaceB.id,
          name:
            'Meta B',
          targetAmount:
            3000,
        });

        const goals =
          await listGoals(
            workspaceA.id,
          );

        expect(
          goals,
        ).toHaveLength(2);

        expect(
          goals.every(
            (goal) =>
              goal.workspaceId ===
              workspaceA.id,
          ),
        ).toBe(true);

        expect(
          goals.some(
            (goal) =>
              goal.name ===
              'Meta B',
          ),
        ).toBe(false);
      },
    );

    test(
      'updates goal name target amount and deadline',
      async () => {
        const workspace =
          await createTestWorkspace();

        const goal =
          await createGoal({
            workspaceId:
              workspace.id,
            name:
              'Meta antiga',
            targetAmount:
              10000,
          });

        const deadline =
          new Date(
            '2028-06-30T00:00:00.000Z',
          );

        const updated =
          await updateGoal({
            workspaceId:
              workspace.id,
            goalId:
              goal.id,
            name:
              'Meta atualizada',
            targetAmount:
              15000,
            deadline,
          });

        expect(
          updated.id,
        ).toBe(goal.id);

        expect(
          updated.name,
        ).toBe(
          'Meta atualizada',
        );

        expect(
          updated.targetAmount.toString(),
        ).toBe('15000');

        expect(
          updated.deadline?.toISOString(),
        ).toBe(
          deadline.toISOString(),
        );

        const persisted =
          await prisma.goal.findUniqueOrThrow({
            where: {
              id:
                goal.id,
            },
          });

        expect(
          persisted.name,
        ).toBe(
          'Meta atualizada',
        );

        expect(
          persisted.targetAmount.toString(),
        ).toBe('15000');
      },
    );

    test(
      'allows removing an existing deadline',
      async () => {
        const workspace =
          await createTestWorkspace();

        const goal =
          await createGoal({
            workspaceId:
              workspace.id,
            name:
              'Meta com prazo',
            targetAmount:
              5000,
            deadline:
              new Date(
                '2027-05-10T00:00:00.000Z',
              ),
          });

        expect(
          goal.deadline,
        ).not.toBeNull();

        const updated =
          await updateGoal({
            workspaceId:
              workspace.id,
            goalId:
              goal.id,
            deadline:
              null,
          });

        expect(
          updated.deadline,
        ).toBeNull();

        const persisted =
          await prisma.goal.findUniqueOrThrow({
            where: {
              id:
                goal.id,
            },
          });

        expect(
          persisted.deadline,
        ).toBeNull();
      },
    );

    test(
      'updates the current amount and calculates progress',
      async () => {
        const workspace =
          await createTestWorkspace();

        const goal =
          await createGoal({
            workspaceId:
              workspace.id,
            name:
              'Entrada do imóvel',
            targetAmount:
              50000,
          });

        const updated =
          await updateGoalAmount({
            workspaceId:
              workspace.id,
            goalId:
              goal.id,
            currentAmount:
              12500,
          });

        expect(
          updated.currentAmount.toString(),
        ).toBe('12500');

        const progress =
          await getGoalProgress(
            workspace.id,
            goal.id,
          );

        expect(
          progress.goal.currentAmount.toString(),
        ).toBe('12500');

        expect(
          progress.goal.targetAmount.toString(),
        ).toBe('50000');

        expect(
          progress.remaining.toString(),
        ).toBe('37500');

        expect(
          progress.percentage.toString(),
        ).toBe('25');

        expect(
          progress.completed,
        ).toBe(false);
      },
    );

    test(
      'marks a goal as completed and never returns a negative remaining amount',
      async () => {
        const workspace =
          await createTestWorkspace();

        const goal =
          await createGoal({
            workspaceId:
              workspace.id,
            name:
              'Viagem',
            targetAmount:
              10000,
          });

        await updateGoalAmount({
          workspaceId:
            workspace.id,
          goalId:
            goal.id,
          currentAmount:
            12000,
        });

        const progress =
          await getGoalProgress(
            workspace.id,
            goal.id,
          );

        expect(
          progress.percentage.toString(),
        ).toBe('120');

        expect(
          progress.remaining.toString(),
        ).toBe('0');

        expect(
          progress.completed,
        ).toBe(true);
      },
    );

    test(
      'validates current amount and deletes a goal',
      async () => {
        const workspace =
          await createTestWorkspace();

        const goal =
          await createGoal({
            workspaceId:
              workspace.id,
            name:
              'Meta removível',
            targetAmount:
              3000,
          });

        await expect(
          updateGoalAmount({
            workspaceId:
              workspace.id,
            goalId:
              goal.id,
            currentAmount:
              -1,
          }),
        ).rejects.toThrow(
          'Current amount must be greater than or equal to zero',
        );

        const unchanged =
          await prisma.goal.findUniqueOrThrow({
            where: {
              id:
                goal.id,
            },
          });

        expect(
          unchanged.currentAmount.toString(),
        ).toBe('0');

        const deleted =
          await deleteGoal({
            workspaceId:
              workspace.id,
            goalId:
              goal.id,
          });

        expect(
          deleted.id,
        ).toBe(goal.id);

        const persisted =
          await prisma.goal.findUnique({
            where: {
              id:
                goal.id,
            },
          });

        expect(
          persisted,
        ).toBeNull();
      },
    );
  },
);