-- AIB-747: One-shot cleanup for outcome rows captured by the previous backfill
-- bug, which incorrectly enumerated CLOSED tickets in addition to SHIP. The
-- live capture path was always SHIP-only, so any TicketOutcome row whose
-- ticket is currently in stage 'CLOSED' must have come from the broken
-- backfill and is meaningless ("nothing was shipped").
--
-- Idempotent: re-running on a database that's already clean is a no-op. Safe
-- across all projects (only touches outcomes whose owning ticket is currently
-- CLOSED, and BackfillProgress rows that may have skipped SHIP tickets due
-- to a CLOSED-tagged neighbour advancing the cursor past them).

-- 1. Delete outcome rows for tickets currently in stage CLOSED.
DELETE FROM "TicketOutcome" o
USING "Ticket" t
WHERE o."ticketId" = t.id
  AND t.stage = 'CLOSED';

-- 2. Invalidate every BackfillProgress row so any subsequent dispatch starts
--    from a clean cursor and re-enumerates all SHIP tickets. The per-ticket
--    P2002 idempotency guard in persistOutcome() ensures already-captured
--    SHIP outcomes are not duplicated. Deleting (rather than updating) keeps
--    the API path simple — the dispatch endpoint creates a fresh row when
--    none exists, with status=IN_PROGRESS and a null cursor.
DELETE FROM "BackfillProgress";
