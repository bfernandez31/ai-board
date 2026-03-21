# Implementation Plan: Persist comparison data to database via workflow

**Branch**: `AIB-330-persist-comparison-data` | **Date**: 2026-03-21 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/spec.md`

## Summary

Add a workflow-driven persistence bridge for `/compare` that keeps markdown generation unchanged, emits a structured JSON handoff artifact beside the markdown report, and posts that payload to a workflow-token-authenticated `POST` comparison endpoint. The endpoint will validate the project/ticket context, reuse the existing comparison persistence service, and return the durable `ComparisonRecord` identifier while workflow failures remain non-fatal to the primary compare artifact.

**Technical Approach**:
1. Extend the compare output flow to write transient `comparison-data.json` in the comparison artifact directory using the same in-memory comparison result that already produces markdown.
2. Add a workflow-only `POST /api/projects/{projectId}/tickets/{ticketId}/comparisons` handler that validates the payload and delegates to the existing comparison persistence service.
3. Update `.github/workflows/ai-board-assist.yml` to detect `comparison-data.json` after `/compare`, submit it with workflow bearer auth, and log success or categorized failures without failing the workflow.
4. Add integration and unit coverage for JSON artifact generation, persistence endpoint behavior, and workflow-side graceful degradation decisions.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, Prisma 6.x, Zod, React 18, GitHub Actions workflow shell scripting, existing comparison helpers in `lib/comparison/`  
**Storage**: PostgreSQL 14+ via Prisma for durable `ComparisonRecord*` tables; markdown and ephemeral JSON artifacts in `specs/{branch}/comparisons/`  
**Testing**: Vitest unit tests for pure mapping/schema helpers, Vitest integration tests for API/database behavior and workflow-auth endpoints; no new Playwright coverage needed  
**Target Platform**: Next.js app plus GitHub Actions workflow execution on ai-board-managed repositories  
**Project Type**: Next.js monolith with workflow automation  
**Performance Goals**: JSON serialization adds under 100 ms after markdown generation; persistence endpoint completes under 1 s for up to 5 participants; workflow logging remains single-request and non-blocking for compare completion  
**Constraints**: `/compare` markdown output must remain the primary committed artifact; persistence failures must not fail `/compare`; endpoint accepts workflow token auth only; payload must map to existing persistence service with no ad hoc workflow-side transformations; invalid or stale JSON must never create partial/orphaned records; `comparison-data.json` must be removed before the workflow commits `specs/$BRANCH` because project-wide comparison discovery still scans committed markdown artifacts  
**Scale/Scope**: One JSON handoff per compare run, 2-5 participants per comparison, one new workflow-only endpoint, one workflow step update, and targeted comparison persistence tests  
**NEEDS CLARIFICATION**: None after Phase 0 research

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | New route, schemas, and compare artifact helpers stay in strict TypeScript with explicit request/response types and no `any`. |
| II. Component-Driven Architecture | PASS | No UI redesign; server changes stay in `app/api/` and `lib/comparison/`, matching existing feature boundaries. |
| III. Test-Driven Development | PASS | Plan assigns pure transforms to unit tests and persistence/auth behavior to integration tests, matching the project testing trophy. |
| IV. Security-First Design | PASS | Workflow-only bearer auth, Zod validation, scoped ticket resolution, and compact structured errors preserve current security expectations. |
| V. Database Integrity | PASS | Design reuses Prisma transactions in `persistComparisonRecord`; malformed payloads are rejected before writes and no raw SQL is introduced. |
| VI. AI-First Development Model | PASS | All design artifacts stay in `specs/AIB-330-persist-comparison-data/`; no root-level docs are added. |

**Initial Gate Status**: PASS

## Project Structure

### Documentation

```text
/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── comparison-persistence.openapi.yaml
```

### Planned Source Changes

```text
/home/runner/work/ai-board/ai-board/target/lib/comparison/
├── comparison-generator.ts                 # write markdown + comparison-data.json payload
├── comparison-record.ts                    # reuse existing persistence service and add any needed idempotency helper
└── [new shared schema/helper if needed]    # artifact/request normalization

/home/runner/work/ai-board/ai-board/target/lib/types/
└── comparison.ts                           # define JSON artifact/request types if not colocated with schemas

/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/
└── route.ts                                # keep GET list route and add workflow-only POST persistence endpoint

/home/runner/work/ai-board/ai-board/target/app/lib/auth/
└── workflow-auth.ts                        # existing bearer token helper reused

/home/runner/work/ai-board/ai-board/target/.github/workflows/
└── ai-board-assist.yml                     # detect comparison-data.json, POST to API, log non-fatal failures

/home/runner/work/ai-board/ai-board/target/tests/
├── unit/comparison/                        # JSON artifact/payload mapping helpers
└── integration/comparisons/                # persistence route success/failure cases
```

**Structure Decision**: Keep compare generation logic in [`/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts`](/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts), add the workflow-ingest write path to the existing comparisons route at [`/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`](/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts), and confine orchestration changes to [`/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml`](/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml) so the markdown-first workflow contract remains intact.

## Complexity Tracking

| Design Decision | Justification | Alternative Considered |
|-----------------|---------------|------------------------|
| Add workflow-side POST bridge instead of direct in-command DB write | Matches the spec’s automation-only ingest model and keeps compare output portable to external target repos | Calling Prisma directly from compare command rejected because compare runs in workflow/repo contexts where app DB access is not the stable integration boundary |
| Keep `comparison-data.json` ephemeral beside markdown and delete it before commit | Gives the workflow a concrete handoff artifact without changing the markdown-only repository history that project-wide compare browsing still depends on | Committing the JSON sidecar rejected because it would add a second durable artifact format and expand current markdown-scanning surfaces unexpectedly |
| Use workflow-only POST on existing comparisons route | Keeps read/write comparison concerns grouped under the ticket-scoped resource while allowing GET and POST auth models to differ by method | Creating a separate `/persist` route rejected as unnecessary extra surface area |
| Add explicit compare-run idempotency key in the payload and persistence path | Prevents accidental duplicate durable records on workflow retry while still allowing intentionally distinct historical runs for the same participant set | Deduping by participant set or markdown path alone rejected because repeated comparisons are valid history entries |

## Phase 0: Outline & Research

Phase 0 resolved the core unknowns from repo inspection:

1. **Workflow integration point**
   - Decision: Extend `.github/workflows/ai-board-assist.yml` after `/compare` execution to look for `specs/$BRANCH/comparisons/comparison-data.json`, POST it using the existing workflow bearer token, and delete the JSON file before the workflow commits `specs/$BRANCH`.
   - Why: The workflow already routes `/compare`, manages branch context, and can safely log non-fatal ingestion failures while preserving markdown as the only committed comparison artifact.

2. **Persistence contract reuse**
   - Decision: Base the JSON artifact on the existing `ComparisonReport` plus scoped persistence metadata (`projectId`, `ticketId`, `markdownPath`, participant ticket IDs, and compare-run idempotency key) so the endpoint can call `persistComparisonRecord()` with minimal translation.
   - Why: `lib/comparison/comparison-record.ts` already contains the transactional write logic and ranking/compliance mapping.

3. **Endpoint pattern**
   - Decision: Add workflow-only `POST /api/projects/{projectId}/tickets/{ticketId}/comparisons` with `verifyWorkflowToken()`, Zod param/body validation, compact `{ error, code }` responses, and explicit `400/401/404/500` mappings.
   - Why: That matches newer workflow-auth route patterns in the repo and keeps automation-only writes isolated from session-auth read flows.

4. **Retry semantics**
   - Decision: Preserve intentionally separate comparison runs, but make workflow retries idempotent by including a unique compare-run key in the payload and persistence path.
   - Why: The current persistence service always creates a new record; retries would otherwise create misleading duplicates.

5. **Historical fidelity boundary**
   - Decision: Persist the same winner, participant order, rationale, recommendation, metrics, decision points, and markdown provenance as today’s structured record, while leaving live telemetry enrichment behavior unchanged for this ticket.
   - Why: The existing dashboard already depends on persisted comparison facts plus live enrichment; AIB-330 is the bridge that supplies the record via workflow.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/research.md`

## Phase 1: Design & Contracts

### Data Model

Phase 1 covers two write-time payload layers:

- **Comparison JSON Artifact**: ephemeral `comparison-data.json` written beside the markdown report for the current compare run.
- **Comparison Persistence Request**: workflow `POST` body that includes the artifact plus scoped route context and compare-run idempotency metadata.

Durable storage continues to use the existing comparison tables:

- `ComparisonRecord`: immutable saved compare run with markdown provenance and generated-at timestamp.
- `ComparisonParticipant`: saved participant ranking, score, workflow type, and agent snapshot.
- `TicketMetricSnapshot`: saved comparison-time code metrics and changed-file list.
- `DecisionPointEvaluation`: saved verdicts and participant approach summaries.
- `ComplianceAssessment`: saved per-principle pass/mixed/fail notes.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/data-model.md`

### API Contracts

Phase 1 defines one new write contract:

- `POST /api/projects/{projectId}/tickets/{ticketId}/comparisons`

The contract includes:
- workflow bearer authentication
- path params for project and source ticket scope
- a request body containing `compareRunKey`, `markdownPath`, report metadata, participant mappings, and the structured comparison report
- a success response returning the created durable comparison record identifier

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/contracts/comparison-persistence.openapi.yaml`

### Quickstart / Implementation Guide

Quickstart records the implementation order, manual verification flow, and expected failure-mode behavior for BUILD.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/quickstart.md`

## Testing Strategy

Search existing comparison and workflow-auth tests first and extend them rather than duplicating fixtures.

### User Story 1

- **Unit tests**: compare artifact serializer creates `comparison-data.json` with the expected report, markdown path, and compare-run key.
- **Integration tests**: workflow-authenticated `POST /comparisons` validates the payload, creates one durable record, and returns the comparison ID.
- **Integration tests**: existing read-side comparison dashboard endpoints can retrieve the newly persisted record.

### User Story 2

- **Unit tests**: missing or invalid JSON artifact detection distinguishes absent, malformed, and incomplete payload states for workflow logging.
- **Integration tests**: POST rejects malformed or mismatched payloads with `400`/`404` and leaves database state unchanged.
- **Workflow-level verification**: update workflow shell logic so missing `comparison-data.json` or failed API submission logs a warning but does not flip compare status to failed.

### User Story 3

- **Integration tests**: persisted record matches markdown-linked report winner, participant ordering, recommendation, decision points, and compliance rows.
- **Unit tests**: idempotency helper treats workflow retries for the same compare-run key as a single durable record while allowing different keys for repeated comparisons.

### Test Layer Decisions

- Pure serializers, request normalizers, and idempotency helpers: `tests/unit/comparison/`
- API route or Prisma-backed persistence behavior: `tests/integration/comparisons/`
- Browser/E2E: not needed because the feature changes workflow and API plumbing, not browser-only interaction

## Post-Design Constitution Re-Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | Contract and artifact schemas are explicit and compatible with strict TS. |
| II. Component-Driven Architecture | PASS | Design remains within established route/helper boundaries and does not introduce ad hoc workflow-only modules. |
| III. Test-Driven Development | PASS | Each user story maps to unit or integration coverage, with no unnecessary E2E expansion. |
| IV. Security-First Design | PASS | Workflow bearer auth, payload validation, scoped ticket resolution, and compact error payloads are preserved post-design. |
| V. Database Integrity | PASS | Persistence stays transactional, rejects malformed payloads before writes, and uses idempotency to avoid misleading duplicates. |
| VI. AI-First Development Model | PASS | Generated docs remain scoped to the ticket spec directory. |

**Post-Design Gate Status**: PASS

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/plan.md` | Complete |
| Research | `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/research.md` | Complete |
| Data Model | `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/data-model.md` | Complete |
| API Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/contracts/comparison-persistence.openapi.yaml` | Complete |
| Quickstart | `/home/runner/work/ai-board/ai-board/target/specs/AIB-330-persist-comparison-data/quickstart.md` | Complete |
