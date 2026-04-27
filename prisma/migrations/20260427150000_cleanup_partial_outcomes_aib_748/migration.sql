-- AIB-748: One-shot cleanup for outcome rows captured before the pivot from
-- Job.commitSha to Ticket.branch as the diff source.
--
-- Every shipped ticket in production was producing a partial outcome with the
-- now-obsolete reason 'no_commit_reference' (because the standard pipeline
-- workflows never populated Job.commitSha). The new branch-centric model
-- resolves the diff via the merged PR's merge_commit_sha, so partial-rate
-- drops to a small minority of edge cases.
--
-- Wipe every partial outcome so the dataset can be rebuilt cleanly by re-running
-- the backfill. Non-partial outcomes (none expected on healthy projects today,
-- but possible on excalidraw test data) are preserved — they were captured via
-- the legacy onboard.yml / retro-spec.yml paths that did emit a SHA.
--
-- Idempotent: re-running on a clean DB is a no-op.

-- 1. Delete every partial outcome row regardless of project.
DELETE FROM "TicketOutcome" WHERE "partial" = TRUE;

-- 2. Reset BackfillProgress so any subsequent dispatch starts from a clean
--    cursor and re-enumerates every SHIP ticket whose outcome is missing.
--    The per-ticket P2002 idempotency guard in persistOutcome() ensures
--    already-captured non-partial SHIP outcomes are not duplicated.
DELETE FROM "BackfillProgress";
