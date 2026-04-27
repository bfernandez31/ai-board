# Quick Implementation: Fix outcome backfill: restrict to SHIP tickets and clean up CLOSED captures

**Feature Branch**: `AIB-747-fix-outcome-backfill`
**Created**: 2026-04-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

The historical outcome backfill currently picks up tickets in stage `CLOSED` in addition to `SHIP`. This contradicts both the original intent of the outcomes feature and the live capture path, which fires only on the `SHIP` transition. As a result:

- The dataset is polluted with rows describing tickets that were never delivered — their outcomes carry no signal of "what was shipped" because nothing was shipped
- The backfill behavior diverges from the live capture behavior, breaking the principle that backfill should produce the same dataset as if live capture had run all along
- The friction-free metric and other derived signals become misleading once they include abandoned tickets in their distribution

This was verified on the excalidraw project (id 171), where a recent backfill captured CLOSED tickets and produced rows with NULL fields that are not meaningful.

## Expected Behavior

The backfill, in all its forms (CLI script, API endpoint, GitHub workflow), processes only tickets in stage `SHIP`. CLOSED tickets are explicitly excluded, matching the live capture path.

A one-shot cleanup deletes the outcome rows that were already created by the previous (broken) backfill for tickets currently in stage `CLOSED`, so that downstream consumers (analysis features, dashboards) never see them.

After this fix, re-running the backfill on a project produces a dataset that exactly matches what live capture would have produced if it had been running since the project's inception.

## Acceptance Criteria

- The backfill query selects only tickets in stage `SHIP`. CLOSED tickets are not enumerated, fetched, or processed at any phase.
- A migration or one-shot cleanup step removes existing outcome rows whose ticket is currently in stage `CLOSED`. The cleanup is idempotent and safe to run on any project.
- The corresponding `BackfillProgress` rows on already-backfilled projects are reset (or otherwise invalidated) so that re-running the backfill picks up SHIP tickets that were skipped because their CLOSED-tagged neighbors had advanced the cursor.
- Tests covering the backfill enumeration explicitly assert that CLOSED tickets are not selected.
- No regression on the live capture path — that path was already SHIP-only and stays unchanged.

## Out of Scope

- Any change to the live capture path (already correct).
- Capturing outcomes for CLOSED tickets in the future under any guise — they remain explicitly excluded.
- The unrelated commit-reference issue affecting partial-row rates (separate ticket).

## Why Now

- Excalidraw already has a polluted dataset; the longer it stays, the more downstream tooling treats it as ground truth.
- Before backfilling ai-board (~410 SHIP tickets), this must be fixed — otherwise the central project of the system gets the same pollution.
- The fix is small and the cleanup step requires the bug to be patched first to avoid re-introducing CLOSED rows on the next run.

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
