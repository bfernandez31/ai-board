-- AIB-786: admin Claude Code Insights reports

CREATE TYPE "InsightsReportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "InsightsReport" (
    "id" SERIAL NOT NULL,
    "status" "InsightsReportStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredById" TEXT NOT NULL,
    "workflowRunId" BIGINT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "ticketCount" INTEGER NOT NULL DEFAULT 0,
    "artifactKey" VARCHAR(300),
    "artifactSize" INTEGER,
    "errorMessage" VARCHAR(2000),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightsReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InsightsReport_status_startedAt_idx" ON "InsightsReport"("status", "startedAt");
CREATE INDEX "InsightsReport_completedAt_idx" ON "InsightsReport"("completedAt" DESC);
