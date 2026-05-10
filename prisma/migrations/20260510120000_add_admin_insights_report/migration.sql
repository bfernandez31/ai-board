-- CreateEnum
CREATE TYPE "AdminInsightsReportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AdminInsightsReport" (
    "id" SERIAL NOT NULL,
    "status" "AdminInsightsReportStatus" NOT NULL DEFAULT 'RUNNING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sessionsCount" INTEGER,
    "ticketsCount" INTEGER,
    "htmlBlobKey" VARCHAR(300),
    "htmlBlobSize" INTEGER,
    "errorReason" VARCHAR(2000),
    "triggeredById" TEXT,
    "workflowRunId" BIGINT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminInsightsReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminInsightsReport_status_idx" ON "AdminInsightsReport"("status");

-- CreateIndex
CREATE INDEX "AdminInsightsReport_status_periodEnd_idx" ON "AdminInsightsReport"("status", "periodEnd");

-- CreateIndex
CREATE INDEX "AdminInsightsReport_createdAt_idx" ON "AdminInsightsReport"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminInsightsReport" ADD CONSTRAINT "AdminInsightsReport_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
