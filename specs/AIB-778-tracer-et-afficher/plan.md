# Implementation Plan: Track and display plugin and agent CLI version per job

**Branch**: `AIB-778-tracer-et-afficher` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-778-tracer-et-afficher/spec.md`

## Summary

For every new job, capture the AI-Board plugin manifest version (`.claude-plugin/plugin.json` → `version`) and the agent CLI version (output of the agent's own version command), persist both as nullable `String` fields on the `Job` model, and surface them in the `JobsTimeline` job-detail panel as compact badges sitting in the same metric zone as model/duration/cost. Capture happens inside the existing `dispatch_agent` flow in `.github/scripts/run-agent.sh` immediately before each agent's `invoke_*` call, then ships the values inline with the existing `PATCH /api/jobs/:id/status` (`status: RUNNING`) callback so no new endpoint or new state transition is introduced. Failure of either capture is logged via existing `log_info`/`log_error` helpers, the field stays absent, and the job continues unaffected.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0, Bash 5.x for runner script
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, Zod, React 18, TanStack Query v5, Tailwind + shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma — adds two nullable `String` columns to existing `Job` table
**Testing**: Vitest unit + integration; React Testing Library for UI components; no E2E required (no browser-only behavior)
**Target Platform**: Linux runner (GitHub Actions) for capture; web app (Vercel) for display
**Project Type**: Web (Next.js single repo: `app/` + `components/` + `lib/` + `prisma/` + `tests/`)
**Performance Goals**: Capture step adds <1s to job start (SC-006); two `--version` shell-outs and one manifest read; no extra DB round trips beyond the already-emitted RUNNING PATCH
**Constraints**:
- Capture failure MUST NOT change job status (FR-004, SC-002)
- No backfill of pre-feature jobs (FR-005, US2 AC3)
- UI must reuse existing badge styling pattern from `components/ticket/jobs-timeline.tsx:135-139`
- Both fields nullable; missing values render as em-dash placeholder, not hidden (FR-007)
**Scale/Scope**: ~2 new DB columns, 1 schema migration, 1 Zod schema extension, 1 API route extension, ~80 lines of bash in run-agent.sh, ~25 lines of JSX in JobsTimeline, ~3 new test cases per surface

## Constitution Check

Evaluated against `.ai-board/memory/constitution.md` v1.8.0.

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. TypeScript-First** | ✅ PASS | All new TS code typed; new Prisma fields generate typed client; Zod schema extends existing one |
| **II. Component-Driven Architecture** | ✅ PASS | UI change is two new compact spans inside existing `JobRow` (no new component needed — the additions are <40 lines and reuse the trigger-row layout, per "Extract a sub-component only when…" rule) |
| **III. Test-Driven Development** | ✅ PASS | New unit tests extend existing `tests/unit/components/jobs-timeline.test.tsx`; integration tests extend `tests/integration/jobs/ticket-jobs.test.ts` and `tests/integration/jobs/status.test.ts`; bash version-extraction logic has unit-testable wrappers |
| **IV. Security-First Design** | ✅ PASS | `--version` output of CLIs is non-secret; values are bounded `VarChar(40)` strings; Zod constrains length on the API side; no new secrets, no new network destinations |
| **V. Database Integrity** | ✅ PASS | New columns are nullable with no default — pre-existing rows stay null without backfill (matches FR-005); single migration; no transaction needed |
| **V. Spec Clarification Guardrails** | ✅ PASS | Spec includes `Auto-Resolved Decisions` block with policies, confidence, and trade-offs |

**Gates**: Zero violations. Complexity Tracking section omitted.

## Project Structure

### Documentation (this feature)

```
specs/AIB-778-tracer-et-afficher/
├── plan.md              # This file
├── spec.md              # Feature specification (already exists)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── job-status-api.md  # PATCH /api/jobs/:id/status — extended with version fields
├── workflows/
│   └── version-capture.md # run-agent.sh changes + per-agent capture rules
└── tasks.md             # Phase 2 output (not produced by this command)
```

### Source Code (repository root)

```
prisma/
├── schema.prisma                                 # ADD pluginVersion, agentCliVersion to Job model
└── migrations/
    └── <timestamp>_add_job_runtime_versions/    # NEW — single migration

app/
├── lib/
│   └── job-update-validator.ts                  # EXTEND jobStatusUpdateSchema with optional pluginVersion + agentCliVersion
└── api/
    ├── jobs/[id]/status/route.ts                # EXTEND PATCH to persist captured version fields on RUNNING transition
    └── projects/[projectId]/tickets/[id]/jobs/route.ts  # EXTEND select clause to return new fields

components/
└── ticket/
    └── jobs-timeline.tsx                        # EXTEND JobRow trigger to render compact plugin/CLI version badges

lib/
└── types/
    └── job-types.ts                             # EXTEND TicketJobWithTelemetry interface with pluginVersion, agentCliVersion

.github/
├── scripts/
│   └── run-agent.sh                             # ADD per-agent version capture + PATCH-with-versions wrapper
└── workflows/
    ├── speckit.yml                              # MODIFY "Update Job Status - Running" step to include captured versions
    ├── verify.yml                               # SAME modification
    ├── quick-impl.yml                           # SAME modification
    ├── iterate.yml                              # SAME modification
    └── ai-board-assist.yml                      # SAME modification

tests/
├── unit/
│   ├── components/jobs-timeline.test.tsx        # EXTEND with version badge rendering tests (rendered, em-dash, partial)
│   └── scripts/run-command.test.ts              # EXTEND with version-capture parsing tests
└── integration/
    └── jobs/
        ├── status.test.ts                        # EXTEND PATCH /status with version fields acceptance + length validation
        └── ticket-jobs.test.ts                   # EXTEND GET /tickets/:id/jobs to assert new fields surfaced
```

**Structure Decision**: Single Next.js repo (existing). All file paths above reference real existing files (verified during Phase 0 inventory) except the new migration directory. The feature crosses three layers — DB/schema, API + workflow runner, UI — but introduces no new modules; every change extends an existing file.

## Testing Strategy

Following constitution §III "Search existing tests FIRST — extend, don't duplicate":

| Surface under test | Action | File |
|--------------------|--------|------|
| Job model + DB column shape | EXTEND existing integration test | `tests/integration/jobs/ticket-jobs.test.ts` |
| `PATCH /api/jobs/:id/status` body validation | EXTEND existing integration test | `tests/integration/jobs/status.test.ts` |
| `JobRow` badge rendering (success, em-dash, partial) | EXTEND existing component test | `tests/unit/components/jobs-timeline.test.tsx` |
| Bash version extraction & PATCH payload assembly | EXTEND existing script unit test | `tests/unit/scripts/run-command.test.ts` |

**No new test files.** No E2E coverage (the feature has no browser-only flow — pure data-display + headless capture).

Test type rationale (constitution §III decision tree):
1. Bash parsing helpers → unit (pure string manipulation)
2. JSX badge rendering → component (Vitest + RTL via existing `renderWithProviders`)
3. PATCH body acceptance + DB persistence → integration (covers Zod + Prisma update path)
4. End-to-end runner-to-UI flow → not needed (mocked at the integration boundary)

## Complexity Tracking

*Not applicable — Constitution Check passed all gates with zero violations.*
