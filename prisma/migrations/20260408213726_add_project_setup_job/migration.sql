-- CreateEnum
CREATE TYPE "SetupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ProjectSetupJob" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "agent" "Agent" NOT NULL,
    "status" "SetupJobStatus" NOT NULL DEFAULT 'PENDING',
    "workflowRunId" BIGINT,
    "errorMessage" VARCHAR(2000),
    "artifactSummary" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSetupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSetupJob_projectId_status_idx" ON "ProjectSetupJob"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectSetupJob_projectId_createdAt_idx" ON "ProjectSetupJob"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ProjectSetupJob" ADD CONSTRAINT "ProjectSetupJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
