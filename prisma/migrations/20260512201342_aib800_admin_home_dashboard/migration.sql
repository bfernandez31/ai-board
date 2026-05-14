-- CreateEnum
CREATE TYPE "WebhookOutcomeStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "CriticalCron" AS ENUM ('NIGHTLY_LOG_PRUNE', 'NIGHTLY_HEALTH_SCANS', 'BILLING_RECONCILE');

-- CreateTable
CREATE TABLE "WebhookOutcome" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "eventId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "status" "WebhookOutcomeStatus" NOT NULL,
    "errorMessage" VARCHAR(1000),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronRun" (
    "id" SERIAL NOT NULL,
    "cron" "CriticalCron" NOT NULL,
    "lastSuccessAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookOutcome_status_receivedAt_idx" ON "WebhookOutcome"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookOutcome_provider_receivedAt_idx" ON "WebhookOutcome"("provider", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CronRun_cron_key" ON "CronRun"("cron");
