-- AIB-856: per-session "analyzed" marker so Insights analysis covers every
-- Claude agent session of every ticket (no earliest-per-ticket dedup, no
-- shipped-only filter) and never analyzes a session twice.
--
-- A row in "InsightsAnalyzedSession" exists iff that session (one Job) was
-- successfully analyzed by a COMPLETED run; absence of a row = eligible. The
-- UNIQUE index on "jobId" is the once-and-only-once guarantee (insert-only,
-- skipDuplicates) — mirrors the partial-unique-index pattern from
-- 20260511130000_insights_single_running_index. No backfill (D-6): the first
-- post-migration run re-establishes coverage over the full eligible corpus
-- (bounded by LOG_RETENTION_DAYS via the rawArtifactKey gate).

CREATE TABLE "InsightsAnalyzedSession" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "reportId" INTEGER NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightsAnalyzedSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InsightsAnalyzedSession_jobId_key" ON "InsightsAnalyzedSession"("jobId");
CREATE INDEX "InsightsAnalyzedSession_reportId_idx" ON "InsightsAnalyzedSession"("reportId");

ALTER TABLE "InsightsAnalyzedSession"
  ADD CONSTRAINT "InsightsAnalyzedSession_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InsightsAnalyzedSession"
  ADD CONSTRAINT "InsightsAnalyzedSession_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "InsightsReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Analyzed-vs-expected coverage accounting (nullable — legacy rows stay null).
ALTER TABLE "InsightsReport" ADD COLUMN "expectedSessionsCount" INTEGER;
