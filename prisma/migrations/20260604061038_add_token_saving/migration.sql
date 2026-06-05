-- CreateEnum
CREATE TYPE "TokenSavingOutcome" AS ENUM ('ACTIVE', 'INACTIVE', 'FELL_BACK');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "tokenSavingOutcome" "TokenSavingOutcome";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "tokenSaving" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "tokenSaving" BOOLEAN;
