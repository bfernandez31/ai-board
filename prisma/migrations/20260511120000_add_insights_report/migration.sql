-- AIB-791: Add admin Insights report model and make Job.ticketId nullable.

-- Make Job.ticketId nullable so insights-analyze Jobs can exist without a Ticket.
ALTER TABLE "Job" DROP CONSTRAINT IF EXISTS "Job_ticketId_fkey";
ALTER TABLE "Job" ALTER COLUMN "ticketId" DROP NOT NULL;
ALTER TABLE "Job"
  ADD CONSTRAINT "Job_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- New InsightsRunStatus enum.
CREATE TYPE "InsightsRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- New InsightsReport table.
CREATE TABLE "InsightsReport" (
    "id" SERIAL NOT NULL,
    "status" "InsightsRunStatus" NOT NULL DEFAULT 'RUNNING',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sessionsCount" INTEGER,
    "ticketsCount" INTEGER,
    "artifactKey" VARCHAR(300),
    "artifactSize" INTEGER,
    "errorReason" VARCHAR(500),
    "jobId" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightsReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InsightsReport_jobId_key" ON "InsightsReport"("jobId");
CREATE INDEX "InsightsReport_status_createdAt_idx" ON "InsightsReport"("status", "createdAt");
CREATE INDEX "InsightsReport_generatedAt_idx" ON "InsightsReport"("generatedAt");
CREATE INDEX "InsightsReport_periodEnd_idx" ON "InsightsReport"("periodEnd");

ALTER TABLE "InsightsReport"
  ADD CONSTRAINT "InsightsReport_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
