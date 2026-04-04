-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "workflowRunId" BIGINT;

-- CreateIndex
CREATE INDEX "Job_workflowRunId_idx" ON "Job"("workflowRunId");
