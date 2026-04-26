# Quick Implementation: Capture ticket outcomes at SHIP for analytics and prediction grounding

**Feature Branch**: `AIB-745-capture-ticket-outcomes`
**Created**: 2026-04-26
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

After 700+ tickets shipped across multiple projects, we have rich raw signals — job telemetry (cost, duration, tokens, tools, quality score), commit references, comment threads, stage transitions — but they live in disconnected tables. Any feature that wants to reason about *what actually happened* on a ticket has to re-aggregate everything from scratch.

Every retrospective question we'd want to ask — "did this ticket ship clean on first shot?", "how much friction did similar tickets historically incur?", "which areas of the codebase tend to need iterations?" — currently requires bespoke joins and heuristics. There is no canonical, queryable representation of a ticket's outcome.

This gap blocks any data-driven prediction feature, and even before any prediction, it blocks honest analytics over our own delivery patterns.

## Expected Behavior

When a ticket reaches stage SHIP, the system records a structured outcome that captures, for that ticket:

- The actual cost and duration consumed, aggregated across all of its jobs
- Which jobs were part of the standard pipeline vs friction — extra iterate runs, comment-triggered re-runs at any stage
- Whether the ticket was effectively *first-shot clean* — a single boolean that captures the philosophy that good tickets ship without iteration or human-prompted fixes
- The final quality score from the verify stage
- The shape of the change: which files were touched, how many lines added or removed, ratio of code vs test changes
- The structural domain of the change: top-level paths affected, plus a small set of generic semantic tags (database schema touched, tests touched, CI touched) derived from the project's declared stack

The outcome is computed once at SHIP, persisted, and never recomputed. It is queryable per project, per domain, and by friction status. It enables future features to ground their reasoning on actual delivery data instead of intuition.

The same logic also runs as a one-shot backfill against historical shipped tickets, so the system starts with a populated dataset rather than an empty one. The whole feature is fully generic: it works on any project supported by the system, regardless of stack.

## Acceptance Criteria

- Every ticket reaching SHIP after this feature deploys has an outcome record persisted within minutes of the SHIP event.
- A backfill mechanism, runnable per project, populates outcomes for historical shipped tickets — idempotent and resumable, safe to re-run.
- The outcome record exposes at minimum: total cost, total duration, counts of pipeline vs friction jobs, final quality score, files touched, lines added/removed, test-vs-code ratio, structural domains, semantic tags, and a derived "frictionFree" boolean.
- Domain extraction works on every project in the system (TypeScript/Next, Python, Go, Rust, Zig, etc.) without per-project configuration files — it relies on the existing project config and on generic patterns.
- The semantic tags `touched_db_schema`, `touched_tests`, `touched_ci` are derived from the project's declared services, testing framework, and language — never hardcoded for a single stack.
- Tickets without a usable commit reference still get an outcome record with job-level signals only, flagged so consumers can detect the partial case rather than missing rows silently.
- Backfill stays within reasonable rate limits on external APIs and is safe to run while the system serves live traffic.
- No regression on any existing flow — this is pure instrumentation and analytics enablement.

## Out of Scope

- Any prediction or analysis feature — separate ticket consuming this dataset.
- A user-facing dashboard over outcomes — possibly later, not in this scope.
- Outcomes for non-shipped tickets (cancelled, abandoned).
- Recomputing outcomes when the domain inference rules later evolve — the outcome is a snapshot at SHIP time.
- Sentiment or qualitative analysis of comment threads — only structural counts are captured.

## Why Now

- The data is already in the system but unused as a structured signal — every day that passes without capturing it cleanly is a missed opportunity.
- Two upcoming features depend on this representation; without it, both would re-implement the same aggregation incorrectly and inconsistently.
- Even standalone, this enables honest analytics over our delivery: "what fraction of our tickets ship first-shot clean?" is a question we cannot answer today.
- Backfilling historical tickets is cheap now while job records and commit references are retained — postponing risks losing usable history.

## Architecture Notes (validated via brainstorm)

Starting points agreed during design; SPECIFY/PLAN are free to revisit any of them with justification:

- One row per shipped ticket, written once at SHIP, never updated.
- Domain = top-level path segment of each touched file, plus three derived boolean tags (db_schema, tests, ci) computed from the project's declared stack and a generic lookup table maintained inside the system itself.
- "frictionFree" = no iterate jobs, no comment-driven jobs, quality score above a calibrated threshold.
- Backfill uses each project's existing credentials to fetch diffs from its target repository; no new secrets introduced.

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
