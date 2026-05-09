-- AIB-779: capture plugin and agent CLI versions per job
ALTER TABLE "Job" ADD COLUMN "pluginVersion" VARCHAR(50);
ALTER TABLE "Job" ADD COLUMN "agentCliVersion" VARCHAR(100);
