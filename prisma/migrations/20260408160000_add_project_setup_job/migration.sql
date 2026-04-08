-- CreateEnum
CREATE TYPE "ProjectSetupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProjectSetupJob" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "selectedAgent" "Agent" NOT NULL,
    "status" "ProjectSetupJobStatus" NOT NULL DEFAULT 'PENDING',
    "dispatchKey" VARCHAR(100),
    "workflowRunId" BIGINT,
    "defaultBranch" VARCHAR(255),
    "commitSha" VARCHAR(40),
    "analysisSummary" JSONB,
    "artifactManifest" JSONB,
    "configPreview" JSONB,
    "errorCode" VARCHAR(100),
    "errorMessage" VARCHAR(2000),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSetupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSetupJob_projectId_idx" ON "ProjectSetupJob"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSetupJob_projectId_status_createdAt_idx" ON "ProjectSetupJob"("projectId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectSetupJob_workflowRunId_idx" ON "ProjectSetupJob"("workflowRunId");

-- CreateIndex
CREATE INDEX "ProjectSetupJob_dispatchKey_idx" ON "ProjectSetupJob"("dispatchKey");

-- AddForeignKey
ALTER TABLE "ProjectSetupJob" ADD CONSTRAINT "ProjectSetupJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
