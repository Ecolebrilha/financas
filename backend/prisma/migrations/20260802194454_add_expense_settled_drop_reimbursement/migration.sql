/*
  Warnings:

  - You are about to drop the `Reimbursement` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "settledAt" DATETIME;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Reimbursement";
PRAGMA foreign_keys=on;
