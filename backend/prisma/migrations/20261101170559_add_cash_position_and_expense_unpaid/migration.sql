-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "unpaid" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CashPosition" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "accountBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashPosition_pkey" PRIMARY KEY ("id")
);
