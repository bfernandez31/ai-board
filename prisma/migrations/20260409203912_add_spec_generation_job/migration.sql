-- CreateEnum
CREATE TYPE "SpecDepth" AS ENUM ('QUICK', 'STANDARD', 'COMPREHENSIVE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "specsGeneratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SpecGenerationJob" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "agent" "Agent" NOT NULL,
    "depth" "SpecDepth" NOT NULL,
    "status" "SetupJobStatus" NOT NULL DEFAULT 'PENDING',
    "documentationUrl" VARCHAR(2000),
    "additionalContext" VARCHAR(5000),
    "workflowRunId" BIGINT,
    "errorMessage" VARCHAR(2000),
    "artifactSummary" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecGenerationJob_projectId_status_idx" ON "SpecGenerationJob"("projectId", "status");

-- CreateIndex
CREATE INDEX "SpecGenerationJob_projectId_createdAt_idx" ON "SpecGenerationJob"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "SpecGenerationJob" ADD CONSTRAINT "SpecGenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
