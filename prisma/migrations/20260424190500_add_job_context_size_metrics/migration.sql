-- AlterTable: add per-turn context telemetry rollups to Job
ALTER TABLE "Job"
ADD COLUMN "peakContextTokens" INTEGER,
ADD COLUMN "averageContextTokens" INTEGER,
ADD COLUMN "contextTurnCount" INTEGER;
