-- AlterEnum
ALTER TYPE "Stage" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "closedAt" TIMESTAMP(3);
