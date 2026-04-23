-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('CAPTURED', 'UNAVAILABLE', 'PRUNED');

-- CreateTable
CREATE TABLE "JobLog" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "captureStatus" "CaptureStatus" NOT NULL,
    "preview" VARCHAR(320) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "artifactKey" VARCHAR(300),
    "artifactSize" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobLog_jobId_key" ON "JobLog"("jobId");

-- CreateIndex
CREATE INDEX "JobLog_captureStatus_createdAt_idx" ON "JobLog"("captureStatus", "createdAt");

-- CreateIndex
CREATE INDEX "JobLog_createdAt_idx" ON "JobLog"("createdAt");

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
