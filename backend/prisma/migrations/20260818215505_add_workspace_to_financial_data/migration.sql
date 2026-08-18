/*
  Warnings:

  - You are about to drop the column `userId` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `budgets` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `goals` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `transactions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[workspaceId,categoryId,month,year]` on the table `budgets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,name,type]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workspaceId` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `budgets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `goals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_userId_fkey";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_userId_fkey";

-- DropForeignKey
ALTER TABLE "goals" DROP CONSTRAINT "goals_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- DropIndex
DROP INDEX "accounts_userId_idx";

-- DropIndex
DROP INDEX "budgets_userId_categoryId_month_year_key";

-- DropIndex
DROP INDEX "budgets_userId_idx";

-- DropIndex
DROP INDEX "categories_userId_idx";

-- DropIndex
DROP INDEX "categories_userId_name_type_key";

-- DropIndex
DROP INDEX "goals_userId_idx";

-- DropIndex
DROP INDEX "transactions_userId_idx";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "budgets" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "goals" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "userId",
ADD COLUMN     "workspaceId" TEXT NOT NULL,
ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "accounts_workspaceId_idx" ON "accounts"("workspaceId");

-- CreateIndex
CREATE INDEX "budgets_workspaceId_idx" ON "budgets"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_workspaceId_categoryId_month_year_key" ON "budgets"("workspaceId", "categoryId", "month", "year");

-- CreateIndex
CREATE INDEX "categories_workspaceId_idx" ON "categories"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_workspaceId_name_type_key" ON "categories"("workspaceId", "name", "type");

-- CreateIndex
CREATE INDEX "goals_workspaceId_idx" ON "goals"("workspaceId");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_idx" ON "transactions"("workspaceId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
