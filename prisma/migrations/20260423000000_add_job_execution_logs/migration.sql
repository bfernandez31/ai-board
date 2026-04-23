-- CreateEnum
CREATE TYPE "JobLogAvailability" AS ENUM ('AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'PRUNED');

-- CreateTable
CREATE TABLE "JobExecutionLog" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "agent" "Agent" NOT NULL,
    "availability" "JobLogAvailability" NOT NULL,
    "sourceFormat" VARCHAR(100) NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "artifactEncoding" VARCHAR(50),
    "artifactBytes" BYTEA,
    "artifactSha256" VARCHAR(64),
    "artifactSizeBytes" INTEGER,
    "partialReason" VARCHAR(500),
    "unavailableReason" VARCHAR(500),
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "retainedUntil" TIMESTAMP(3) NOT NULL,
    "prunedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobExecutionLog_jobId_key" ON "JobExecutionLog"("jobId");

-- CreateIndex
CREATE INDEX "JobExecutionLog_projectId_capturedAt_idx" ON "JobExecutionLog"("projectId", "capturedAt");

-- CreateIndex
CREATE INDEX "JobExecutionLog_ticketId_capturedAt_idx" ON "JobExecutionLog"("ticketId", "capturedAt");

-- CreateIndex
CREATE INDEX "JobExecutionLog_availability_retainedUntil_idx" ON "JobExecutionLog"("availability", "retainedUntil");

-- CreateIndex
CREATE INDEX "JobExecutionLog_prunedAt_idx" ON "JobExecutionLog"("prunedAt");

-- AddForeignKey
ALTER TABLE "JobExecutionLog" ADD CONSTRAINT "JobExecutionLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
