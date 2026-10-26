-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "dueDateFollowsPurchase" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "icon" TEXT;
