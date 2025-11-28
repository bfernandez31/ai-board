-- AlterTable: Add Claude telemetry metrics to Job table
ALTER TABLE "Job" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "Job" ADD COLUMN "outputTokens" INTEGER;
ALTER TABLE "Job" ADD COLUMN "cacheReadTokens" INTEGER;
ALTER TABLE "Job" ADD COLUMN "cacheCreationTokens" INTEGER;
ALTER TABLE "Job" ADD COLUMN "costUsd" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "Job" ADD COLUMN "model" VARCHAR(50);
ALTER TABLE "Job" ADD COLUMN "toolsUsed" TEXT[] DEFAULT ARRAY[]::TEXT[];
