# Quick Implementation: Remove ticket-outcomes backfill scaffolding once historical capture is complete

**Feature Branch**: `AIB-771-remove-ticket-outcomes`
**Created**: 2026-05-02
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

The historical backfill mechanism for ticket outcomes is intrinsically a one-shot operation: each project either has been backfilled or not, and once done it has no legitimate reason to ever run again. New projects onboarded later start with an empty ticket history, so there is nothing to backfill for them. Outcomes themselves are immutable snapshots taken at SHIP, never recomputed — there is no "reimport" use case either.

Yet the backfill scaffolding currently lives in the codebase as a GitHub workflow, two API endpoints, a CLI script, a workflow-dispatch helper, a `BackfillProgress` table, and a chunk of integration tests. As long as that surface stays alive, it carries three real costs that buy us nothing:

- The `DATABASE_URL` secret has to either stay provisioned on the repo (giving CI runners durable access to the production database) or be re-added every time the backfill is re-run, which is a recurring ritual that nobody wants to memorize
- The code rots. Six months from now, no one will remember why the workflow exists or whether it is safe to run
- It is dead surface from a security and maintenance standpoint, with no execution path that actually serves the product

## Expected Behavior

Once historical outcomes have been backfilled for every project that needed it, the entire backfill pathway is removed from the codebase. The product retains only the live capture path — the one that fires automatically on every SHIP transition.

After this cleanup:

- There is no API endpoint, no GitHub workflow, no CLI script, and no dispatch helper related to backfill anywhere in the codebase
- The `BackfillProgress` table is dropped through a clean Prisma migration
- The repository no longer needs the `DATABASE_URL` secret to be present
- The live capture continues to work exactly as before, with no behavioral or performance change

The shared core (the outcome capture logic, the stack-indicator lookup, the persistence layer) stays intact — it is consumed by the SHIP transition path and is not specific to backfill.

## Acceptance Criteria

- All backfill-specific source files, API routes, GitHub workflow, and tests are removed.
- A Prisma migration drops the `BackfillProgress` table cleanly.
- The `DATABASE_URL` repository secret is removed in the same change set, since no remaining workflow consumes it.
- The live SHIP capture path is verified after the change: a freshly shipped ticket still produces a `TicketOutcome` record within the expected delay.
- No regression on outcomes already captured — historical rows remain untouched and queryable.
- No regression on any existing flow (ticket creation, stage transitions, board views, analytics that read outcomes).
- All remaining outcome-related tests still pass; tests that were specific to backfill are removed alongside the code they exercised.

## Out of Scope

- Re-introducing a different backfill mechanism in the future. If a new column is later added to the outcome record and historical rows need it populated, that will be a fresh, leaner one-shot at that moment, scoped only to the new column.
- Removing or changing the live capture path (the automatic SHIP hook) — explicitly preserved.
- Removing the `TicketOutcome` table or the shared capture logic — explicitly preserved.
- Cleanup of any unrelated dead code in the codebase.

## Dependencies

- The historical backfill must have been run successfully for every project for which a historical dataset is wanted, before this ticket starts. A simple pre-condition check (count of SHIP tickets vs count of outcome rows per project) makes this objectively verifiable.

## Why Now

- Once the backfill is done, every additional day the scaffolding stays alive is a day of dead surface accumulating risk and cognitive cost.
- The `DATABASE_URL` secret is currently the lever that gates this decision: keeping the workflow means keeping the secret available, and the secret is the most consequential piece of the surface to keep removable.
- This is a small, well-bounded cleanup. Doing it while the context is fresh is much cheaper than doing it later as archaeology, when nobody remembers what was load-bearing.

## Architecture Notes (validated via brainstorm)

- The cleanup is a pure subtraction; nothing is replaced.
- The drop migration on `BackfillProgress` should be straightforward — single table, no foreign-key dependencies pointing at it from other tables.
- A simple sanity check (the live capture still fires on SHIP) is enough verification — no new test harness needed.

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

Implementation will be done directly by Claude Code based on the description above.
