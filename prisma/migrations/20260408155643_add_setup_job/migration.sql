-- CreateEnum
CREATE TYPE "SetupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SetupJob" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "selectedAgent" "Agent" NOT NULL,
    "status" "SetupJobStatus" NOT NULL DEFAULT 'PENDING',
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "completedFiles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errorMessage" VARCHAR(2000),
    "workflowRunId" BIGINT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetupJob_projectId_status_idx" ON "SetupJob"("projectId", "status");

-- CreateIndex
CREATE INDEX "SetupJob_projectId_createdAt_idx" ON "SetupJob"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "SetupJob" ADD CONSTRAINT "SetupJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
