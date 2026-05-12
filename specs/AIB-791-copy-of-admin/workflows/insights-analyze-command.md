# Agent Command: Insights Analyze

**Feature**: AIB-791
**Date**: 2026-05-11

The `insights-analyze` command is dispatched as a `Job` (alongside its `InsightsReport`) to the
new `.github/workflows/insights-analyze.yml`. Unlike most existing AI-Board commands, the
"agent" invoked is **not** Claude-Code-as-a-coder — it is Claude-Code-as-a-pre-built-`/insights`-
analyzer. There is no specification authoring, no plan/implement loop, no PR. The command is
effectively a "run a fixed analyzer over a corpus and upload the result".

## Identifier

`insights-analyze`

This is a new value of the existing `Job.command` VarChar column. The CLAUDE.md `Job commands`
bullet list MUST be updated to include it.

## Arguments

Passed as inputs to the workflow (see `insights-analyze-workflow.md`):

| Argument | Type | Source |
|----------|------|--------|
| `report_id` | string (int) | Trigger endpoint creates `InsightsReport`, passes its id. |
| `job_id` | string (int) | Trigger endpoint creates `Job`, passes its id. |
| `period_start` | ISO string | Trigger endpoint computed bound. |
| `period_end` | ISO string | Trigger endpoint computed bound (`= generatedAt`). |
| `app_url` | string | Deployment base URL the workflow calls back to. |

## Functional phases

The workflow's phases mirror the spec's "Insights Analysis Process":

1. **PATCH job → RUNNING** (announce start, satisfies the job-log capture phase boundary).
2. **Enumerate Claude sessions** for the window via `GET /api/admin/insights/jobs` (the
   single-shared-predicate from D-6, FR-025).
3. **Download** each raw native JSONL artifact to a local directory.
4. **Run `claude /insights`** (NOT a free-text prompt — FR-011) with the directory as input and
   a known output path.
5. **Validate the produced HTML** for structural markers (FR-026, D-8).
6. **Upload** the HTML through `PUT /api/admin/insights/reports/:id/finalize` (server-side
   validation runs again as defense in depth).
7. **Compute counts** — `sessionsCount` = number of enumerated jobs, `ticketsCount` = distinct
   ticketIds in the enumeration.
8. **PATCH report → COMPLETED** with the metadata.
9. **PATCH job → COMPLETED**.

On any step failure: catch in the `failure()` step, PATCH report → FAILED with a non-secret
reason, PATCH job → FAILED.

## Output

- One `InsightsReport` row in a terminal status (COMPLETED or FAILED).
- On COMPLETED: one HTML artifact at `insights/reports/<report_id>.html` in Vercel Blob.
- One `Job` row in a terminal status (COMPLETED or FAILED) with the standard log artifact
  flow available.

## Callback / reporting contract

The workflow reports status via the endpoints listed in `contracts/admin-api.md`. All callbacks
are workflow-token-authenticated (A-WORKFLOW). The web app NEVER holds blob credentials; it
proxies the upload through `PUT /…/finalize`, identical to how `PUT /api/jobs/:id/logs/
raw-artifact` works today.

The workflow does NOT call `/api/jobs/:id/status` for COMPLETED with a quality score or any
other side effects beyond the basic status transition — the existing job-completion auto-mode
hooks (push notifications, auto-transition) are NOT triggered for `insights-analyze` jobs
(FR-022). Implementation detail: gate the auto-transition hook in
`handleJobCompletionAutoTransition` on `command !== 'insights-analyze'`.

## Skill / plugin metadata

If the workflow invokes Claude Code via the existing `.github/scripts/run-agent.sh` skill
pattern (as `.github/workflows/speckit.yml` does), a new skill is registered:

- **Skill name**: `ai-board.insights-analyze` (or equivalent, matching the existing
  `ai-board.*` naming convention surfaced in the prompt's skill list).
- **Skill body**: A short instruction document that tells the Claude Code session to invoke
  the built-in `/insights` slash command with the provided sessions directory and output path,
  then exit. It MUST NOT permit free-text prompting or alternate analyzers.

Alternative: invoke `bunx @anthropic-ai/claude-code /insights ...` directly from the workflow,
bypassing the skill registry. The workflow doc shows this form as the simpler default; an
implementation decision in Phase 2 can swap to a skill if `/insights` requires interactive
input that can only be supplied through a skill bridge.

## Non-goals

- The command does NOT produce a PR or branch.
- The command does NOT consult `.ai-board/config.yml` for agent or model overrides — `/insights`
  ships with Claude Code; the only credential it needs is `ANTHROPIC_API_KEY`.
- The command does NOT modify any project's source code.
