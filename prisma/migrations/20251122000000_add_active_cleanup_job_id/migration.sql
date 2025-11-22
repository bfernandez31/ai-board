-- AlterEnum
ALTER TYPE "WorkflowType" ADD VALUE 'CLEAN';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "activeCleanupJobId" INTEGER;

-- CreateIndex
CREATE INDEX "Project_activeCleanupJobId_idx" ON "Project"("activeCleanupJobId");
