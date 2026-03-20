# Implementation Plan: Ticket Comparison Dashboard

**Branch**: `AIB-325-ticket-comparison-dashboard` | **Date**: 2026-03-20 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/spec.md`

## Summary

Add a database-backed comparison dashboard that preserves the current `/compare` markdown artifact while also storing a structured comparison record discoverable from every participating ticket. The new read path will move from branch-scanned markdown files to ticket-authorized Prisma queries that return immutable comparison analysis plus live ticket, telemetry, and quality enrichments in one response.

**Technical Approach**:
1. Add Prisma models for immutable comparison records, participants, metric snapshots, decision points, and compliance assessments.
2. Update `/compare` generation to persist a structured record and markdown artifact for the same run without duplicating existing ticket or job source-of-truth data.
3. Replace ticket comparison history/detail APIs with DB-backed endpoints keyed by comparison ID and protected by `verifyTicketAccess()`.
4. Replace the markdown-only comparison modal with a structured comparison dashboard that supports history, ranking, metrics, decision analysis, and constitution grids.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5.90.5, Zod, shadcn/ui, lucide-react
**Storage**: PostgreSQL 14+ via Prisma for structured comparison records; markdown files in `specs/{branch}/comparisons/` retained for backward compatibility
**Testing**: Vitest unit tests, Vitest integration tests, RTL component tests; no browser-only requirement identified, so no new Playwright coverage planned
**Target Platform**: Vercel-hosted Next.js app with GitHub workflow execution for `/compare`
**Project Type**: Next.js monolith
**Performance Goals**: comparison history response under 100 ms for a single ticket; comparison detail response under 200 ms for up to 5 participants; `/compare` persistence overhead under 1 second beyond existing markdown generation
**Constraints**: ticket access must use existing project authorization rules; comparison records are immutable after creation; optional enrichments must render as pending/unavailable; no duplication of ticket metadata, telemetry, or quality score as source-of-truth data
**Scale/Scope**: single project per comparison, 2-5 participating tickets in practice, historical comparison records retained indefinitely
**NEEDS CLARIFICATION**: None after Phase 0 research

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | All new persistence models, DTOs, and UI props are typed; no `any` required. |
| II. Component-Driven Architecture | PASS | Reuses feature folders, shadcn/ui primitives, and Next.js route handlers; comparison dashboard remains an isolated feature surface. |
| III. Test-Driven Development | PASS | Plan assigns unit tests only to pure mapping logic, component tests to interactive dashboard sections, and integration tests to API/database behavior. |
| IV. Security-First Design | PASS | All comparison reads go through `verifyTicketAccess()` or `verifyProjectAccess()`; request params are Zod-validated; no sensitive workflow secrets exposed. |
| V. Database Integrity | PASS | New schema changes go through Prisma migration, use foreign keys and uniqueness constraints, and keep comparison creation in a transaction. |
| VI. AI-First Development Model | PASS | Artifacts stay inside `specs/AIB-325-ticket-comparison-dashboard/`; no root tutorial or README files are introduced. |

**Initial Gate Status**: PASS

## Project Structure

### Documentation

```text
/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── comparison-dashboard.openapi.yaml
```

### Planned Source Changes

```text
/home/runner/work/ai-board/ai-board/target/prisma/
└── schema.prisma                            # add comparison persistence models

/home/runner/work/ai-board/ai-board/target/lib/comparison/
├── comparison-generator.ts                 # persist structured record alongside markdown
├── comparison-record.ts                    # new mapping/persistence service
└── comparison-detail.ts                    # new enrichment/query helpers

/home/runner/work/ai-board/ai-board/target/lib/types/
└── comparison.ts                           # replace markdown-centric DTOs with structured history/detail DTOs

/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/
├── route.ts                                # DB-backed history list
├── check/route.ts                          # lightweight existence/count endpoint
└── [comparisonId]/route.ts                 # structured detail payload

/home/runner/work/ai-board/ai-board/target/components/comparison/
├── comparison-viewer.tsx                   # structured dashboard modal
├── comparison-history-list.tsx             # history selector
├── comparison-ranking.tsx                  # ranking and recommendation
├── comparison-metrics-grid.tsx             # metrics comparison
├── comparison-decision-points.tsx          # collapsible decision sections
└── comparison-compliance-grid.tsx          # constitution matrix

/home/runner/work/ai-board/ai-board/target/hooks/
└── use-comparisons.ts                      # history/detail hooks keyed by comparison ID

/home/runner/work/ai-board/ai-board/target/tests/
├── unit/comparison/
├── unit/components/
└── integration/comparisons/
```

## Complexity Tracking

| Design Decision | Justification | Alternative Considered |
|-----------------|---------------|------------------------|
| Store comparison-specific analysis in relational records with JSON subdocuments | Supports discovery from any ticket and stable history without duplicating live ticket/job truth | Continue parsing markdown files rejected because it is branch-biased and formatting-fragile |
| Keep markdown artifact in parallel with DB record | Preserves `/compare` backward compatibility and auditability for existing flows | Replace markdown entirely rejected by FR-014 and FR-015 |
| Enrich detail responses from live ticket and job sources | Avoids duplicating telemetry and quality data while preserving current-state visibility | Snapshot all enrichments rejected because it would create a second source of truth |
| Use ticket-scoped read endpoints keyed by `comparisonId` | Matches discovery from ticket detail, reuses authorization helpers, and supports history selection | Project-wide only endpoints rejected because ticket modal remains the primary entry point |

## Phase 0: Outline & Research

Phase 0 resolved the core unknowns documented during repo inspection:

1. **Persistence model**
   - Decision: Use Prisma-backed `ComparisonRecord` and related child records for immutable comparison-only facts.
   - Why: Existing implementation stores markdown under a single branch and cannot discover the same comparison from every participant.

2. **Source-of-truth boundaries**
   - Decision: Persist comparison analysis and snapshots captured during `/compare`, but join current ticket metadata and job-derived telemetry/quality at read time.
   - Why: FR-003 forbids duplicating authoritative ticket and telemetry records.

3. **Read API shape**
   - Decision: Expose ticket history, lightweight check, and ticket-scoped detail endpoints with structured payloads keyed by numeric `comparisonId`.
   - Why: The current filename-based API is coupled to branch layout and markdown parsing.

4. **UI integration**
   - Decision: Keep the existing ticket-detail entry point but swap the modal body from raw markdown rendering to a structured dashboard.
   - Why: This minimizes workflow disruption while satisfying the new ranking, metrics, decisions, and compliance requirements.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/research.md`

## Phase 1: Design & Contracts

### Data Model

Phase 1 defines five persisted entities:

- `ComparisonRecord`: one immutable `/compare` run, tied to project and source ticket, with markdown provenance and recommendation summary.
- `ComparisonParticipant`: one row per participating ticket, enabling discovery from any ticket and storing saved rank/score/rationale.
- `TicketMetricSnapshot`: one row per participant containing comparison-time code metrics that do not exist elsewhere as durable truth.
- `DecisionPointEvaluation`: one row per decision point with per-ticket approaches and final verdict.
- `ComplianceAssessment`: one row per constitution principle per participant for the saved comparison result.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/data-model.md`

### API Contracts

Phase 1 defines the public comparison dashboard contracts:

- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons`
- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/check`
- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}`

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/contracts/comparison-dashboard.openapi.yaml`

### Quickstart / Implementation Guide

Quickstart captures the implementation order, affected files, and acceptance validation flow for the eventual BUILD phase.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/quickstart.md`

## Testing Strategy

Search existing comparison tests first and extend them rather than duplicating them.

### User Story 1

- **Integration tests**: ticket history endpoint returns the same comparison from any participating ticket; unauthorized requests are rejected; closed or shipped tickets still return historical comparisons.
- **Component tests**: ticket detail modal shows the comparison entry point when the check endpoint reports history and opens the viewer with the latest comparison selected.

### User Story 2

- **Integration tests**: detail endpoint returns ranking, decision points, compliance rows, and live enrichment states in one payload; missing telemetry and quality values are labeled `pending` or `unavailable`.
- **Component tests**: ranking section renders ordered participants and winner; metrics grid highlights best values only when meaningful; decision points expand/collapse correctly; compliance matrix renders consistent ticket-by-principle cells.

### User Story 3

- **Integration tests**: `/compare` persistence service creates one markdown artifact plus one structured comparison record, associates all participants, and preserves multiple historical runs for overlapping ticket sets.
- **Unit tests**: pure mapping helpers that translate existing comparison output into persisted record DTOs and derive display states from nullable enrichments.

### Test Layer Decisions

- Pure mapping logic with no React or Prisma dependency: `tests/unit/comparison/`
- Interactive React dashboard sections: `tests/unit/components/`
- API routes or Prisma-backed persistence/query logic: `tests/integration/comparisons/`
- E2E: not planned unless implementation later requires browser-only behavior beyond current modal interactions

## Post-Design Constitution Re-Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | `data-model.md` and OpenAPI schemas define typed request/response and persistence shapes. |
| II. Component-Driven Architecture | PASS | Design stays within comparison feature folders and reuses the ticket modal entry point. |
| III. Test-Driven Development | PASS | Test plan maps every user story to the correct layer and defaults uncertain work to integration tests. |
| IV. Security-First Design | PASS | Contracts require ticket-scoped auth and Zod validation; no raw SQL or secret exposure introduced. |
| V. Database Integrity | PASS | All new entities are relationally constrained and created transactionally with immutable semantics. |
| VI. AI-First Development Model | PASS | All planning artifacts remain under the ticket spec directory. |

**Post-Design Gate Status**: PASS

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/plan.md` | Complete |
| Research | `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/research.md` | Complete |
| Data Model | `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/data-model.md` | Complete |
| API Contracts | `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/contracts/comparison-dashboard.openapi.yaml` | Complete |
| Quickstart | `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/quickstart.md` | Complete |
| Agent Context Update | `/home/runner/work/ai-board/ai-board/target/CLAUDE.md` | Script executed; no diff produced |
