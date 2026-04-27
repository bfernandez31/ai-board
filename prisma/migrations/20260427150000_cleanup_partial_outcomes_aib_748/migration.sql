-- AIB-748: One-shot cleanup for outcome rows captured before the pivot from
-- Job.commitSha to Ticket.branch as the diff source.
--
-- Every shipped ticket in production was producing a partial outcome with the
-- now-obsolete reason 'no_commit_reference' (because the standard pipeline
-- workflows never populated Job.commitSha). The new branch-centric model
-- resolves the diff via the merged PR's merge_commit_sha, so partial-rate
-- drops to a small minority of edge cases.
--
-- Wipe only the rows produced by that obsolete reason so the dataset can be
-- rebuilt cleanly by re-running the backfill. Other partial reasons (e.g.
-- 'repository_unreachable') are preserved — they're still meaningful under the
-- new model and should not be discarded. Non-partial outcomes are also
-- preserved.
--
-- Idempotent: re-running on a clean DB is a no-op.

-- 1. Delete partial outcome rows captured under the obsolete reason only.
DELETE FROM "TicketOutcome"
  WHERE "partial" = TRUE
    AND "partialReason" = 'no_commit_reference';

-- 2. Reset BackfillProgress so any subsequent dispatch starts from a clean
--    cursor and re-enumerates every SHIP ticket whose outcome is missing.
--    The per-ticket P2002 idempotency guard in persistOutcome() ensures
--    already-captured non-partial SHIP outcomes are not duplicated.
DELETE FROM "BackfillProgress";
