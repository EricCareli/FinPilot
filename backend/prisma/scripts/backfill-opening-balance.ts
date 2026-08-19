import { prisma } from '../../src/lib/prisma.js';

const ACCOUNT_ID = '93ac9e99-de54-4f78-b081-8cd7cfe0373d';

async function main() {
  const account = await prisma.account.findUnique({
    where: {
      id: ACCOUNT_ID,
    },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  const existingEntry = await prisma.ledgerEntry.findFirst({
    where: {
      accountId: account.id,
    },
  });

  if (existingEntry) {
    console.log('Opening balance already exists. Nothing to do.');
    return;
  }

 if (account.initialBalance.isZero()) {
    console.log('Initial balance is zero. Nothing to do.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.financialTransaction.create({
      data: {
        workspaceId: account.workspaceId,
        type: 'ADJUSTMENT',
        status: 'POSTED',
        description: 'Initial account balance',
        transactionDate: account.createdAt,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: account.id,
        type: account.initialBalance.greaterThan(0)
          ? 'CREDIT'
          : 'DEBIT',
        amount: account.initialBalance.abs(),
      },
    });
  });

  console.log(
    `Opening balance created for account: ${account.name}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });