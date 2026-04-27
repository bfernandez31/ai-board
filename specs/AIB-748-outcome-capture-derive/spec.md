# Quick Implementation: Outcome capture: derive commit reference from ticket branch as canonical source

**Feature Branch**: `AIB-748-outcome-capture-derive`
**Created**: 2026-04-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

Outcome capture currently relies on `Job.commitSha` as its primary input to fetch the diff that describes what a ticket changed. This was a flawed assumption: across the 14 GitHub workflows in the project, only `onboard.yml` and `retro-spec.yml` actually emit a commit SHA when reporting job status. The standard pipeline workflows — `speckit.yml` (SPECIFY/PLAN/BUILD), `quick-impl.yml`, `verify.yml`, `iterate.yml`, `auto-ship.yml` — never populate it.

Consequences observed in production:

- Every shipped ticket in the live system produces a partial outcome (`partialReason: 'no_commit_reference'`) because none of its jobs carry a SHA
- The diff-derived signals (`filesTouched`, `linesAdded`, `linesRemoved`, `testCodeRatio`, `domains`, `touchedDbSchema`, `touchedTests`, `touchedCi`) are all empty or null on every row
- The outcome dataset is structurally useless for any downstream consumer — including the upcoming analysis feature whose retrieval depends on structural-domain overlap
- The backfill on excalidraw demonstrated this pattern; ai-board would behave identically if backfilled today

The deeper issue is conceptual, not just instrumental. The actual ground truth for "what did this ticket change" is **the diff between the ticket's branch and the project's default branch** — the contribution that gets merged at SHIP. The intermediate `commitSha` values on individual jobs are implementation detail of how the agent worked, not a description of what the ticket delivered.

`Ticket.branch` is always set: it is created deterministically by the system code at SPECIFY (FULL workflow) or quick-impl (QUICK workflow). Unlike `Job.commitSha`, its population does not depend on every workflow remembering to emit a payload field correctly. It is reliable by construction.

## Expected Behavior

Outcome capture pivots to a branch-centric model. When a ticket reaches SHIP — or when the backfill processes a historical SHIP ticket — capture resolves the merge contribution of `Ticket.branch` against the project's default branch and uses that single reference as the source of the diff.

The resolution path:

- Read `Ticket.branch` directly from the ticket.
- Look up the merged pull request whose head is this branch and whose base is the project's default branch — the GitHub API exposes a `merge_commit_sha` field on this PR that persists even after the feature branch is deleted.
- Fetch the diff associated with that single merge commit (or, when a merge commit cannot be located, fall back to comparing the branch's tip with the default branch's tip if the branch ref still exists).
- Pass the resulting list of files and line counts to the existing derivation pipeline (domain extraction, semantic tags, test ratio).

`Job.commitSha` becomes irrelevant to outcome capture. The aggregation logic that currently collects job-level SHAs is removed. Job telemetry (cost, duration, tokens, tools, quality score, classification into pipeline vs friction) continues to be computed exactly as today — that path was always sound.

The partial-outcome reasons evolve to reflect the new model:

- `no_branch_reference` — `Ticket.branch` is empty (legacy ticket, edge case)
- `merge_not_found` — no merged PR can be located for the branch (unexpected for a SHIP ticket; surface as partial so consumers see it)
- `repository_unreachable` — GitHub API rejects the call (auth / quota)
- `fetch_failed_after_retry` — transient failure, retried out

The outcome of the change: on any healthy SHIP ticket, the capture produces a complete row with diff-derived signals populated. The partial-rate drops from ~100% (current) to a small minority of edge cases.

## Acceptance Criteria

- The capture path no longer reads or depends on `Job.commitSha`. Removing the field's population from the system would not affect outcomes (it remains in the schema for unrelated callers, but it is dead input to outcomes).
- For a freshly shipped ticket whose branch was merged via a normal PR flow, the captured outcome is non-partial and exposes populated `filesTouched`, `linesAdded`, `linesRemoved`, `testCodeRatio`, `domains`, and the three semantic tags.
- The capture works correctly when the feature branch has been deleted post-merge (auto-delete enabled). The merge commit on the default branch is still resolved through the pull-request lookup.
- The backfill, after the migration, produces non-partial outcomes for the vast majority of historical SHIP tickets on ai-board and on any other project where tickets were merged via standard pull requests.
- Existing partial outcomes captured before this change (currently all of them, with reason `no_commit_reference`) are removed in a one-shot cleanup so that the dataset is rebuilt cleanly. After cleanup, the backfill is re-runnable to populate the new model.
- Partial-reason vocabulary is updated to describe the branch-centric model. Consumers reading `partialReason` see one of the new values, not the obsolete `no_commit_reference`.
- GitHub API usage remains within reasonable bounds: at most one PR-lookup call and one diff fetch per ticket. Rate-limit headroom on a typical project must be sufficient to backfill all SHIP tickets without throttling.
- All outcome-related tests are updated to the new model. Tests that mocked `Job.commitSha` are rewritten around `Ticket.branch` and the PR lookup.
- No regression on any unrelated flow.

## Out of Scope

- Re-instrumenting the standard pipeline workflows to populate `Job.commitSha`. After this change, that field is no longer load-bearing for outcomes; if other consumers want it, they can pursue it separately.
- Removing the `Job.commitSha` column from the database schema. It remains for any other consumer (e.g., features showing per-job links to commits in the UI). Only the outcomes pipeline stops reading it.
- Any change to the analysis or calibration features that consume outcomes.
- Cross-project optimizations of GitHub API calls (batching across projects, etc.).

## Dependencies

- The CLOSED-tickets fix on the backfill should be merged first, so that the cleanup-and-rerun cycle for this ticket starts from a clean slate.

## Why Now

- The current outcome capture is producing zero usable data despite running successfully — a silent failure mode that gives the false impression the feature works.
- The downstream features that depend on outcomes (analysis, calibration) cannot be built or tested meaningfully on partial-only data.
- The fix changes the conceptual ground truth from "what each agent committed" to "what the ticket delivered", which is what we always meant — the prior model was a premature optimization that turned out to be a fiction. Aligning the implementation with the actual semantics is overdue.

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
