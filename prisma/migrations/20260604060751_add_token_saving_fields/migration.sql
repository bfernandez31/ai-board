-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "tokenSavingStatus" VARCHAR(20);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "tokenSaving" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "tokenSaving" BOOLEAN;
