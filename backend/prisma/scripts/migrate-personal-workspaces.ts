import { prisma } from '../../src/lib/prisma.js';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      workspaceMemberships: {
        none: {},
      },
    },
  });

  for (const user of users) {
    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: 'Personal',
          type: 'PERSONAL',
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
        },
      });
    });

    console.log(`Workspace created for user: ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });