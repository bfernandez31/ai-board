-- AIB-776: Capture native Claude Code session JSONL alongside normalized logs.
-- Adds optional fields to JobLog so a second Blob artifact (the raw, native
-- agent session) can live alongside the existing normalized one.

ALTER TABLE "JobLog" ADD COLUMN "rawArtifactKey" VARCHAR(300);
ALTER TABLE "JobLog" ADD COLUMN "rawArtifactSize" INTEGER;
