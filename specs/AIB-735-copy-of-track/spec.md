# Quick Implementation: Copy of Track per-turn context size on jobs to analyze context rot impact on quality

**Feature Branch**: `AIB-735-copy-of-track`
**Created**: 2026-04-24
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

Today we track aggregated token usage per job (total input, output, cache-read, cost, duration) but we have no visibility into **how large the conversation context grew at any single point during the run**. That hides a variable the industry calls "context rot": as the context window fills up mid-run, model quality measurably degrades well before the hard token limit is hit.

Concretely, we cannot answer questions like:

- For tickets where the quality score dropped unexpectedly, was the job operating with a context that was too large at some point?
- Are FULL-workflow verify jobs systematically hitting higher peak context than QUICK-workflow implement jobs?
- Which commands (implement, verify, ship, iterate) are most exposed to context-rot risk on this project?
- Is there a context-size threshold above which quality reliably tanks in our data, and if so, where?

Without this data we're flying blind on a quality variable that is almost certainly affecting our results — especially on larger tickets with many file reads, tool calls, and iterations.

## Expected Behavior

Every job that uses an agent which emits per-call token telemetry (Claude today, Codex and Gemini being compatible formats) should record three additional metrics on completion:

- **Peak context size** — the largest context size observed at any single turn during the run. This is the value that matters most: a job with 50 small turns and one 80K-token turn is at risk; a job averaging 40K with no peak above 45K is not.
- **Average context size** — the mean across all turns. Useful to distinguish "one outlier turn" from "the whole run was heavy".
- **Turn count** — how many model calls happened. Combined with the average, this gives a sense of how hard the agent worked and where token budget was spent.

These values must:

1. Be visible on the existing job timeline UI with a subtle indicator when they cross visually meaningful thresholds (e.g., a neutral pill for healthy values, an amber pill around a warning threshold, a red pill around a danger threshold — exact thresholds to be tuned based on observed data).
2. Be queryable in aggregate so we can cross them with the existing `qualityScore` field and validate whether there is a real correlation between peak context size and quality degradation.
3. Degrade gracefully for agents that don't provide per-turn breakdowns (e.g., Mistral sends aggregated totals today) — the fields are simply left empty and the UI does not display an indicator.

## Acceptance Criteria

- Three new metrics are recorded on completed jobs for Claude runs: peak context size, average context size, turn count.
- The job timeline item surfaces these values with an at-a-glance visual indicator keyed to a danger threshold.
- A project-level or global analytics view exposes the distribution of peak context size and allows filtering/grouping by command type, workflow type (FULL vs QUICK), and quality-score bucket.
- The values are populated automatically from telemetry we already receive — no additional runner-side instrumentation should be required.
- Jobs from agents without per-turn telemetry (Mistral currently) complete normally with these fields unset and the UI hides the indicator for them rather than showing zeros.
- Historical jobs created before this feature shipped are not backfilled — they simply have the new fields unset, and the UI handles that case.
- No regression on any existing telemetry field (total tokens, cost, duration, tools used, quality score).

## Out of Scope

- Automatic QUICK-vs-FULL recommendation on INBOX tickets based on predicted context size. That is a follow-up ticket — it requires first validating with real data that the correlation between peak context and quality holds on this project. Shipping a recommendation engine before validation would be guessing.
- A per-turn growth curve visualization (line chart of context size turn-by-turn). Nice to have eventually, out of scope here.
- Alerting or notifications when a live job crosses a danger threshold — post-hoc analysis only for now.
- Normalizing context-rot telemetry across all four agents. This ticket ships the metric for Claude; extending to other agents is a follow-up driven by how the other agents expose per-call data.

## Why Now

We just shipped the captured-log feature (AIB-715) which gives us post-hoc narrative context. This ticket adds the quantitative counterpart: **numbers** we can regress against quality score to actually learn something. Once this has run for two or three weeks we will either have empirical evidence of context rot in our data — unlocking the follow-up recommendation feature — or we will have ruled it out and saved ourselves from building a solution to a non-problem.

## Follow-up This Unlocks

Once sufficient data is accumulated (suggest two to three weeks of normal usage), we can open a follow-up ticket to:

- Compute a ticket-level context-risk estimate at INBOX time based on historical jobs for similar-scoped tickets on this project.
- Surface that estimate on the ticket creation/transition UI so the user can decide QUICK vs FULL with a data-backed expectation of how far the agent can push before quality degrades.

That follow-up explicitly depends on this ticket having first validated the hypothesis with real numbers.

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
