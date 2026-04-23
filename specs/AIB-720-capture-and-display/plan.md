# Implementation Plan: Capture and display agent execution logs

**Branch**: `AIB-720-capture-and-display` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-720-capture-and-display/spec.md`

## Summary

Capture terminal job execution transcripts for Claude, Codex, Mistral, and Gemini by adding a dedicated persisted log artifact model, uploading normalized log bundles from the workflow runner after agent execution completes, and surfacing both a condensed preview and a full readable log view in the existing ticket job experiences. The design keeps live polling and telemetry intact, avoids bloating the `Job` row with full transcripts, and makes retention/pruning explicit for at least 30 days.

## Technical Context

| Aspect | Detail |
|--------|--------|
| Language / Runtime | TypeScript 5.9 strict, Node.js 22.20.0, Bash in GitHub Actions |
| Primary Dependencies | Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5, shadcn/ui, lucide-react, Zod |
| Storage | PostgreSQL 14+ via Prisma; dedicated log artifact table with compressed payload bytes and prunable metadata |
| Testing | Vitest unit/integration, Playwright only if an existing browser-only gap remains |
| Target Platform | Web application with GitHub Actions workflow callbacks |
| Project Type | Next.js full-stack web application |
| Performance Goals | Timeline preview remains lightweight; full log retrieval is on-demand; terminal log upload finishes within the existing workflow completion window |
| Constraints | No real-time streaming, same ticket authorization rules, no Tailwind class name construction, retain logs for >=30 days, avoid disproportionate growth in the primary `Job` table |
| Scale / Scope | 1 additive Prisma model + enum, 3-4 API route changes/additions, workflow runner changes, ticket UI extensions, retention cleanup path |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | New log DTOs, API contracts, Prisma models, and UI props will be explicitly typed; no `any` is needed. |
| II. Component-Driven | PASS | The feature extends existing ticket modal, timeline, and shadcn dialog patterns instead of introducing a new surface area. |
| III. Test-Driven | PASS | Existing job, timeline, stats, and modal tests will be extended first; only the upload/retrieval contract needs a new integration file because no current test owns that domain. |
| IV. Security-First | PASS | Workflow upload remains bearer-token authenticated, viewer access stays behind `verifyProjectAccess` / `verifyTicketAccess`, and no secrets are exposed in stored log payloads. |
| V. Database Integrity | PASS | Full transcripts move to a dedicated relation instead of the hot `Job` row, upload is idempotent per job, and dispatch/status failure handling patterns remain intact. |
| V. Spec Clarification | PASS | The spec already documents post-completion-only behavior, summary-vs-detail separation, normalized multi-agent display, and 30-day retention. |

**Gate Result**: PASS. Proceed with research and design.

### Post-Design Check

| Gate | Status | Evidence |
|------|--------|----------|
| Typed boundaries only | PASS | `JobExecutionLog`, summary/detail DTOs, and API schemas are all modeled explicitly in `data-model.md` and `contracts/job-logs.openapi.yaml`. |
| Authorization preserved | PASS | Upload uses workflow auth only; read paths remain project-member scoped and inherit current ticket/job access checks. |
| DB growth controlled | PASS | Summary metadata stays query-friendly while full events are stored compressed in a dedicated table and pruned after retention. |
| External failures do not corrupt job state | PASS | Log upload is additive and non-blocking relative to terminal job status, following existing callback and cleanup patterns. |
| Existing tests extended first | PASS | `tests/integration/jobs/status.test.ts`, `tests/integration/jobs/ticket-jobs.test.ts`, `tests/integration/tickets/timeline.test.ts`, `tests/unit/components/ticket-detail-modal.test.tsx`, and `tests/unit/components/ticket-stats.test.tsx` remain the primary extension points. |

**Gate Result**: PASS. No blocking constitution violations remain.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-720-capture-and-display/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── contracts/
│   └── job-logs.openapi.yaml
└── workflows/
    ├── job-log-capture-workflow.md
    ├── job-log-retrieval-presentation.md
    └── job-log-retention-pruning.md
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                                      # MODIFY: add JobExecutionLog relation + enum(s)

app/
├── api/jobs/[id]/status/route.ts                      # MODIFY: trigger/coordinate terminal log capture metadata
├── api/projects/[projectId]/tickets/[id]/jobs/route.ts# MODIFY: include log summary availability fields
├── api/projects/[projectId]/tickets/[id]/timeline/route.ts
│                                                     # MODIFY: include preview-ready log summary on job events
├── api/projects/[projectId]/jobs/[jobId]/logs/route.ts# NEW: member-scoped full log retrieval
├── api/jobs/[id]/logs/route.ts                        # NEW: workflow-scoped terminal log upload
├── lib/
│   ├── hooks/queries/use-conversation-timeline.ts     # MODIFY: consume preview shape changes
│   ├── query-keys.ts                                  # MODIFY: add job log detail key
│   ├── schemas/
│   │   └── job-logs.ts                                # NEW: upload/read schemas
│   ├── types/
│   │   └── conversation-event.ts                      # MODIFY: add log preview payload to job events
│   └── utils/conversation-events.ts                   # MODIFY: merge preview metadata into job events

components/
├── board/ticket-detail-modal.tsx                      # MODIFY: host full-log dialog and entry points
├── ticket/conversation-timeline.tsx                   # MODIFY: pass preview actions/data through
├── ticket/jobs-timeline.tsx                           # MODIFY: summary preview + "View full logs" action
├── timeline/job-event-timeline-item.tsx               # MODIFY: condensed preview rendering in timeline
└── ticket/job-log-dialog.tsx                          # NEW: detailed readable log dialog

lib/
├── db/tickets.ts                                      # MODIFY: avoid cloning heavy log artifacts with copied jobs
├── telemetry/otlp-processor.ts                        # MODIFY: preserve existing metrics path while sharing normalized event helpers where useful
└── job-logs/
    ├── normalize.ts                                   # NEW: provider-agnostic normalization pipeline
    ├── storage.ts                                     # NEW: compression, persistence, pruning helpers
    └── summary.ts                                     # NEW: condensed preview builder

.github/
├── scripts/run-agent.sh                               # MODIFY: capture provider-native execution output and upload terminal log bundle
└── workflows/
    ├── speckit.yml                                    # MODIFY: upload logs before terminal status callback
    ├── quick-impl.yml                                 # MODIFY: upload logs before terminal status callback
    ├── iterate.yml                                    # MODIFY: upload logs before terminal status callback
    ├── verify.yml                                     # MODIFY: upload logs before terminal status callback
    └── ai-board-assist.yml                            # MODIFY: upload logs before terminal status callback

tests/
├── integration/jobs/
│   ├── status.test.ts                                 # EXTEND: terminal callback + upload coordination
│   ├── ticket-jobs.test.ts                            # EXTEND: summary availability in ticket jobs API
│   └── logs.test.ts                                   # NEW: upload/read/prune contract for job logs
├── integration/tickets/timeline.test.ts               # EXTEND: preview rendering payload in timeline API
├── unit/components/
│   ├── ticket-detail-modal.test.tsx                   # EXTEND: dialog entry points and modal behavior
│   └── ticket-stats.test.tsx                          # EXTEND: job summary and unavailable/pruned states
└── unit/job-log-normalizer.test.ts                    # NEW: provider normalization and summary extraction
```

**Structure Decision**: Keep the feature inside the existing job/ticket architecture. Lightweight summary fields flow through the current ticket APIs, while a dedicated project-scoped log detail route serves the full artifact on demand. Workflow capture remains in `.github/scripts/run-agent.sh` plus terminal callback steps in the existing job-producing workflows.

## Complexity Tracking

No constitution violations require justification at planning time.

## Implementation Phases

### Phase 1: Data Model and Persistence Foundation

**Goal**: Add a dedicated log artifact relation and explicit availability state without turning `Job` into the transcript store.

1. Extend `prisma/schema.prisma` with `JobExecutionLog` and a log availability enum per `data-model.md`.
2. Keep `Job` as the source of truth for status and telemetry; add only the relation and query-facing summary metadata needed for efficient joins.
3. Implement `lib/job-logs/storage.ts` for gzip compression/decompression, idempotent upsert, and pruning transitions.
4. Update Prisma access patterns so ticket/job list reads select summary metadata only, never full compressed payload bytes.
5. Ensure ticket duplication in `lib/db/tickets.ts` does not duplicate retained log artifacts for cloned jobs.

### Phase 2: Workflow Capture and Normalization

**Goal**: Capture provider-native output after execution completes, normalize it once, and upload it before the terminal status callback finishes.

1. Extend `.github/scripts/run-agent.sh` to emit a structured terminal log bundle for Claude, Codex, Mistral, and Gemini:
   - Reuse existing provider-specific telemetry knowledge and session files where available.
   - Persist local temporary capture files during the run, then synthesize a normalized upload payload once the agent exits.
2. Add `lib/job-logs/normalize.ts` and `lib/job-logs/summary.ts`:
   - Parse provider-specific message/tool/error/output shapes.
   - Produce a common ordered event list plus preview summary.
   - Mark capture as `PARTIAL` or `UNAVAILABLE` when provider output is incomplete.
3. Add `POST /api/jobs/[id]/logs` for workflow-authenticated upload.
4. Update `.github/workflows/speckit.yml`, `.github/workflows/quick-impl.yml`, `.github/workflows/iterate.yml`, `.github/workflows/verify.yml`, and `.github/workflows/ai-board-assist.yml` so the log upload happens before the final success/failure/cancelled status callback.

### Phase 3: Read APIs and Timeline Integration

**Goal**: Reuse existing ticket inspection surfaces by exposing summary data in lightweight endpoints and full logs via a separate on-demand route.

1. Extend `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` to return:
   - `logAvailability`
   - `logCapturedAt`
   - `logSummary`
   - `logRetainedUntil`
   - `logPrunedAt`
2. Extend `app/api/projects/[projectId]/tickets/[id]/timeline/route.ts` and `app/lib/utils/conversation-events.ts` so job events carry preview-safe log summary data without inlining the full transcript.
3. Add `GET /api/projects/[projectId]/jobs/[jobId]/logs` for full log retrieval under existing member authorization rules.
4. Update `app/lib/schemas/job-logs.ts`, `app/lib/types/conversation-event.ts`, and `app/lib/query-keys.ts` to keep contracts typed end to end.

### Phase 4: Ticket UI Presentation

**Goal**: Keep the current ticket experience compact while making detailed logs easy to open.

1. Extend `components/timeline/job-event-timeline-item.tsx` to show the condensed preview:
   - terminal outcome
   - latest significant events
   - partial/unavailable/pruned notice
   - `View full logs` CTA when retained detail exists
2. Extend `components/ticket/jobs-timeline.tsx` so job rows show summary state alongside existing telemetry instead of replacing it.
3. Add `components/ticket/job-log-dialog.tsx` and host it from `components/board/ticket-detail-modal.tsx`.
4. Preserve current stats cards, quality score, polling, and nested-dialog behavior.

### Phase 5: Retention and Pruning

**Goal**: Enforce the 30-day guarantee while keeping a durable audit trail after detailed content is removed.

1. Add pruning logic in `lib/job-logs/storage.ts`:
   - select retained logs older than the cutoff
   - remove compressed payload bytes
   - preserve summary and audit metadata
   - mark the artifact `PRUNED`
2. Expose pruned state through list/timeline/detail APIs so the UI can distinguish missing detail from failed capture.
3. Document the execution mechanism in `workflows/job-log-retention-pruning.md`; implementation can follow the same pattern used for notification retention cleanup.

### Phase 6: Test Extensions

**Goal**: Cover normalization, workflow upload, API reads, and UI behavior with the cheapest tests that match the change surface.

1. Extend `tests/integration/jobs/status.test.ts` for terminal job/update coordination and idempotent log upload behavior.
2. Extend `tests/integration/jobs/ticket-jobs.test.ts` for summary fields, unavailable state, and pruned state.
3. Add `tests/integration/jobs/logs.test.ts` because no existing file owns the upload + full retrieval contract.
4. Extend `tests/integration/tickets/timeline.test.ts` for preview payloads and access control.
5. Extend `tests/unit/components/ticket-detail-modal.test.tsx` and `tests/unit/components/ticket-stats.test.tsx` for CTA visibility, dialog behavior, and unavailable/pruned notices.
6. Add `tests/unit/job-log-normalizer.test.ts` for provider adapters and summary extraction logic.

## Testing Strategy

The constitution requires extending existing tests first. This feature should use the following ownership:

| File | Extend or New | Why |
|------|---------------|-----|
| `tests/integration/jobs/status.test.ts` | Extend | Existing owner for `PATCH /api/jobs/:id/status` terminal behavior and workflow token auth. |
| `tests/integration/jobs/ticket-jobs.test.ts` | Extend | Existing owner for ticket-scoped job payload shape and telemetry fields. |
| `tests/integration/tickets/timeline.test.ts` | Extend | Existing owner for merged ticket timeline behavior and serialization rules. |
| `tests/unit/components/ticket-detail-modal.test.tsx` | Extend | Existing owner for modal tab/action behavior and nested dialog regressions. |
| `tests/unit/components/ticket-stats.test.tsx` | Extend | Existing owner for job timeline rendering inside the stats surface. |
| `tests/integration/jobs/logs.test.ts` | New | No current file owns the upload + full detail retrieval + retention contract without mixing unrelated concerns. |
| `tests/unit/job-log-normalizer.test.ts` | New | No existing unit file covers provider transcript normalization. |

Recommended coverage split:

1. Unit: provider normalization, summary extraction, compression/decompression helpers.
2. Integration: upload route, ticket jobs route, timeline route, member access control, prune state, duplicate ticket non-copy behavior.
3. Component: preview rendering, full-log dialog loading/error states, unavailable/pruned notices.
4. E2E: skip unless a browser-only interaction gap remains after RTL coverage.

## Design Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Research | `specs/AIB-720-capture-and-display/research.md` | Decisions, existing-file inventory, concrete patterns to follow |
| Data Model | `specs/AIB-720-capture-and-display/data-model.md` | Entity definitions, relationships, validation, retention states |
| Contract | `specs/AIB-720-capture-and-display/contracts/job-logs.openapi.yaml` | Upload/read API contract and summary/detail schemas |
| Workflow | `specs/AIB-720-capture-and-display/workflows/job-log-capture-workflow.md` | Terminal capture/upload lifecycle |
| Workflow | `specs/AIB-720-capture-and-display/workflows/job-log-retrieval-presentation.md` | Timeline preview and full-log presentation contract |
| Workflow | `specs/AIB-720-capture-and-display/workflows/job-log-retention-pruning.md` | Retention cutoff and pruning behavior |

