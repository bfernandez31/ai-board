# Implementation Plan: Persist Structured Decision Points in Comparison Data

**Branch**: `AIB-352-persist-structured-decision` | **Date**: 2026-03-26 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/spec.md`

## Summary

Fix comparison persistence so newly generated comparisons save decision-point-specific verdicts, rationales, and per-ticket approach summaries instead of synthesizing every `DecisionPointEvaluation` from report-level recommendation and summary fields. The design keeps the existing relational persistence model and comparison dialog, but extends the comparison report contract and generator so markdown and structured data are produced from the same ordered `decisionPoints` source.

**Technical Approach**:
1. Extend `ComparisonReport` and the serialized workflow payload with a typed `decisionPoints` collection.
2. Update comparison generation instructions and markdown rendering to produce and display those structured decision points in the same run.
3. Replace fallback synthesis in `buildDecisionPoints()` with direct mapping from structured report data into existing `DecisionPointEvaluation` rows.
4. Preserve legacy records by continuing to read already-saved fallback decision points without migration.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, Zod, TanStack Query v5.90.5, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma for `ComparisonRecord` and `DecisionPointEvaluation`; markdown and JSON comparison artifacts under `specs/{branch}/comparisons/`
**Testing**: Vitest unit tests, Vitest integration tests, RTL component tests
**Target Platform**: Vercel-hosted Next.js application with workflow-authenticated comparison persistence routes
**Project Type**: Next.js monolith
**Performance Goals**: keep comparison persistence overhead within current workflow expectations with no extra network round-trips; keep comparison detail reads at current ticket-dialog latency for up to 5 participants and 10 decision points
**Constraints**: no migration or regeneration requirement for historical comparisons; no fabricated decision-point details for new comparisons; preserve saved decision-point order; maintain markdown/structured consistency for the same run; validate workflow payloads with Zod
**Scale/Scope**: comparison runs are project-scoped, usually 2-5 tickets, and may contain 0 or more ordered decision points
**NEEDS CLARIFICATION**: None after Phase 0 research

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | The fix is contract-heavy: new report and payload types, no `any`, and explicit mapping between ticket keys and persisted IDs. |
| II. Component-Driven Architecture | PASS | Existing comparison feature folders and route handlers remain the implementation surface; the viewer keeps using existing shadcn/ui composition. |
| III. Test-Driven Development | PASS | Plan assigns unit coverage to mapping/validation helpers, integration coverage to workflow persistence and detail routes, and component coverage to decision-point rendering/fallback behavior. |
| IV. Security-First Design | PASS | Workflow payload remains Zod-validated, ticket reads remain authorization-gated, and no new secret or raw SQL handling is introduced. |
| V. Database Integrity | PASS | Existing relational models and transaction boundaries are reused; no unsafe backfill or manual schema mutation is required. |
| VI. AI-First Development Model | PASS | All generated planning artifacts stay within `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/`. |

**Initial Gate Status**: PASS

## Project Structure

### Documentation

```text
/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── comparison-decision-persistence.openapi.yaml
```

### Planned Source Changes

```text
/home/runner/work/ai-board/ai-board/target/lib/types/
└── comparison.ts                                   # extend ComparisonReport with structured decision-point types

/home/runner/work/ai-board/ai-board/target/lib/comparison/
├── comparison-payload.ts                          # validate and normalize structured decision-point payloads
├── comparison-generator.ts                        # generate markdown from the same structured decision-point collection
└── comparison-record.ts                           # persist report.decisionPoints directly into DecisionPointEvaluation rows

/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/
└── route.ts                                       # keep workflow payload validation aligned with updated report contract

/home/runner/work/ai-board/ai-board/target/components/comparison/
└── comparison-decision-points.tsx                 # continue rendering saved rows; add/extend empty and legacy fallback coverage as needed

/home/runner/work/ai-board/ai-board/target/tests/
├── unit/comparison/
├── unit/components/
└── integration/comparisons/
```

**Structure Decision**: Reuse the existing Next.js monolith layout and comparison feature boundaries. This feature is a targeted contract, generator, and persistence refinement, not a new subsystem.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Outline & Research

Phase 0 resolved the initial unknowns and removed all `NEEDS CLARIFICATION` items:

1. **Current fallback behavior**
   - Decision: Treat the current `buildDecisionPoints()` synthesis as legacy-only behavior.
   - Rationale: New comparisons currently reuse `alignment.matchingRequirements`, global recommendation, global summary, and file-count metrics for every decision point, which is the defect this ticket is fixing.
   - Alternatives considered: Keep synthesizing decision points from report-level fields; rejected because it violates FR-001 through FR-010 for newly generated comparisons.

2. **Persistence surface**
   - Decision: Reuse the existing `DecisionPointEvaluation` table and JSON `participantApproaches` field rather than adding new Prisma models.
   - Rationale: The current schema already supports title, verdict, rationale, ordered approaches, and display order; the problem is that new records are populated with fallback content.
   - Alternatives considered: Add new tables or migrate historical rows; rejected because existing storage is sufficient and FR-011 forbids requiring migrations/regeneration for readability.

3. **Comparison payload contract**
   - Decision: Add structured `decisionPoints` to `ComparisonReport` and its serialized workflow payload schema.
   - Rationale: The current report and POST payload have no place to carry per-decision verdict/rationale/approach data, forcing persistence code to invent it.
   - Alternatives considered: Parse the markdown report back into structure during persistence; rejected because it is brittle and can drift from the generator output.

4. **Markdown consistency**
   - Decision: Generate the human-readable decision-point section from the same structured `report.decisionPoints` collection used for persistence.
   - Rationale: This keeps the saved JSON payload and markdown materially aligned for a single comparison run.
   - Alternatives considered: Continue emitting markdown-only decision analysis and save structure separately; rejected because it risks inconsistency and weakens FR-008.

5. **Legacy compatibility**
   - Decision: Preserve existing read-path normalization and UI behavior for already-saved comparisons, including empty and partially populated decision-point arrays.
   - Rationale: Historical comparisons must remain viewable without backfill work.
   - Alternatives considered: Introduce stricter read-time validation that hides incomplete saved rows; rejected because it would regress historical records.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/research.md`

## Phase 1: Design & Contracts

### Data Model

The persisted relational model remains centered on existing entities:

- `ComparisonRecord`: immutable saved comparison run and markdown provenance.
- `DecisionPointEvaluation`: one saved decision choice per comparison with title, `verdictTicketId`, `verdictSummary`, `rationale`, `participantApproaches`, and `displayOrder`.
- `ComparisonReportDecisionPoint` and `ComparisonReportDecisionPointApproach`: new TypeScript and payload-layer entities that become the source for `DecisionPointEvaluation` creation during new comparison persistence.

Design emphasis:

- No Prisma schema expansion is required if the existing `DecisionPointEvaluation` shape is retained.
- New-comparison validation must allow incomplete decision-point data only by preserving what the generator actually produced, never by fabricating missing per-ticket content.
- Legacy rows continue to normalize through the current `normalizeDecisionPoints()` read path.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/data-model.md`

### API Contracts

Phase 1 defines the contract changes for:

- `POST /api/projects/{projectId}/tickets/{ticketId}/comparisons`
- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}`

The POST contract adds structured `report.decisionPoints`. The GET detail contract remains stable externally, but its decision-point items become reliably decision-specific for newly generated comparisons while historical comparisons remain fallback-compatible.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/contracts/comparison-decision-persistence.openapi.yaml`

### Quickstart / Implementation Guide

Quickstart captures the recommended BUILD order:

1. Extend comparison types and Zod schemas.
2. Update comparison-generation prompt/producer and markdown rendering.
3. Replace fallback persistence mapping with direct decision-point mapping plus legacy-safe guards.
4. Extend unit, integration, and component coverage.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/quickstart.md`

## Testing Strategy

Search existing comparison tests first and extend them rather than duplicating them.

### User Story 1 - Review Distinct Decision Points in the Comparison Dialog

- **Integration tests**: extend `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts` and related fixtures so a workflow-authenticated POST saves multiple decision points with distinct verdicts, rationales, and per-ticket approaches.
- **Integration tests**: extend `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts` or `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-dashboard-api.test.ts` to verify the detail payload returns the same ordered decision-point content later.
- **Component tests**: extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx` for focused decision-point accordion assertions and keep `/home/runner/work/ai-board/ai-board/target/tests/unit/components/markdown-table-rendering.test.tsx` as the viewer-level smoke test.

### User Story 2 - Preserve Backward Compatibility for Historical Comparisons

- **Integration tests**: create or extend a fixture with legacy-style saved decision points and verify the detail route still returns them without migration.
- **Component tests**: add coverage for empty and partial decision-point data so the viewer continues to show current fallback or empty-state behavior without crashing.

### User Story 3 - Save Decision-Point Structure at Comparison Time

- **Unit tests**: extend `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-payload.test.ts` for Zod validation and normalization of the new `report.decisionPoints` contract.
- **Unit tests**: extend `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts` for direct mapping from structured decision points into Prisma create input, including sparse participant-approach handling.
- **Integration tests**: verify workflow persistence preserves decision-point count and ordering from the POST payload.

### Test Layer Decisions

- Pure function or schema/mapping logic: `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/`
- React component interaction and rendering: `/home/runner/work/ai-board/ai-board/target/tests/unit/components/`
- API route or Prisma-backed persistence/query logic: `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/`
- E2E: not planned because the feature does not introduce browser-only behavior

## Post-Design Constitution Re-Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | `data-model.md` and contracts define explicit typed decision-point payloads and persistence mapping. |
| II. Component-Driven Architecture | PASS | The design stays within existing comparison modules and the current dialog surface. |
| III. Test-Driven Development | PASS | Each user story maps to unit, integration, and component layers using the project decision tree. |
| IV. Security-First Design | PASS | POST payload remains Zod-validated and GET detail authorization remains ticket-scoped. |
| V. Database Integrity | PASS | Existing relational constraints and transactional persistence remain sufficient; no destructive migration path is needed. |
| VI. AI-First Development Model | PASS | All artifacts remain within the ticket spec directory and agent context update follows the repo workflow. |

**Post-Design Gate Status**: PASS

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/plan.md` | Complete |
| Research | `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/research.md` | Complete |
| Data Model | `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/data-model.md` | Complete |
| API Contracts | `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/contracts/comparison-decision-persistence.openapi.yaml` | Complete |
| Quickstart | `/home/runner/work/ai-board/ai-board/target/specs/AIB-352-persist-structured-decision/quickstart.md` | Complete |
| Agent Context Update | `/home/runner/work/ai-board/ai-board/target/CLAUDE.md` | Completed via `update-agent-context.sh claude` |
