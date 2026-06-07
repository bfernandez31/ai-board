-- AIB-852: per-session coverage marker + expected/gap accounting on InsightsReport.

-- New gap-reason enum.
CREATE TYPE "InsightsCoverageGapReason" AS ENUM ('TRANSCRIPT_NOT_AVAILABLE');

-- Expected/gap accounting columns on InsightsReport (no backfill — existing
-- COMPLETED reports leave these null; their sessions become eligible on the
-- next run).
ALTER TABLE "InsightsReport" ADD COLUMN "expectedSessionsCount" INTEGER;
ALTER TABLE "InsightsReport" ADD COLUMN "coverageGapReason" "InsightsCoverageGapReason";

-- New per-session coverage table. `jobId` UNIQUE enforces analyzed-at-most-once.
CREATE TABLE "InsightsSessionCoverage" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "reportId" INTEGER NOT NULL,
    "coveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightsSessionCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InsightsSessionCoverage_jobId_key" ON "InsightsSessionCoverage"("jobId");
CREATE INDEX "InsightsSessionCoverage_reportId_idx" ON "InsightsSessionCoverage"("reportId");

ALTER TABLE "InsightsSessionCoverage"
  ADD CONSTRAINT "InsightsSessionCoverage_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InsightsSessionCoverage"
  ADD CONSTRAINT "InsightsSessionCoverage_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "InsightsReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
