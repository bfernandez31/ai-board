-- CreateEnum
CREATE TYPE "InsightsRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "InsightsRun" (
    "id" SERIAL NOT NULL,
    "status" "InsightsRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "sessionCount" INTEGER,
    "ticketCount" INTEGER,
    "reportKey" VARCHAR(300),
    "reportSize" INTEGER,
    "errorMessage" VARCHAR(2000),
    "timeoutAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightsRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsightsRun_status_createdAt_idx" ON "InsightsRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InsightsRun_createdAt_idx" ON "InsightsRun"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "InsightsRun_status_idx" ON "InsightsRun"("status");

-- AddForeignKey
ALTER TABLE "InsightsRun" ADD CONSTRAINT "InsightsRun_triggeredBy_fkey" FOREIGN KEY ("triggeredBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
