-- AlterTable
ALTER TABLE "Job"
  ADD COLUMN "pluginVersion" VARCHAR(100),
  ADD COLUMN "agentCliVersion" VARCHAR(100);
