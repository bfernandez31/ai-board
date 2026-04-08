CREATE TYPE "ProjectSetupStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "ProjectSetupAttempt" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "selectedAgent" "Agent" NOT NULL,
    "status" "ProjectSetupStatus" NOT NULL DEFAULT 'PENDING',
    "workflowRunId" BIGINT,
    "attemptNumber" INTEGER NOT NULL,
    "statusMessage" VARCHAR(500),
    "failureCode" VARCHAR(100),
    "failureMessage" VARCHAR(2000),
    "artifactSummary" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSetupAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProjectSetupAttempt"
ADD CONSTRAINT "ProjectSetupAttempt_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProjectSetupAttempt_projectId_attemptNumber_key"
ON "ProjectSetupAttempt"("projectId", "attemptNumber");

CREATE INDEX "ProjectSetupAttempt_projectId_createdAt_idx"
ON "ProjectSetupAttempt"("projectId", "createdAt" DESC);

CREATE INDEX "ProjectSetupAttempt_projectId_status_idx"
ON "ProjectSetupAttempt"("projectId", "status");
