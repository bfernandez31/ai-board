# Implementation Plan: Redesign Comparison Dialog as Mission Control Dashboard

**Branch**: `AIB-355-redesign-comparison-dialog` | **Date**: 2026-03-26 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/spec.md`

## Summary

Redesign the existing comparison dialog into a dashboard that makes the winner immediately obvious, keeps every participant visible in one comparison session, merges the current implementation and operational metric views into a single relative matrix, and strengthens compliance and decision-point scanning without changing the underlying comparison persistence or retrieval APIs.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, shadcn/ui, TailwindCSS 3.4, lucide-react, TanStack Query v5, Zod  
**Storage**: PostgreSQL 14+ via Prisma 6.x (read-only for this feature; no schema changes planned)  
**Testing**: Vitest unit/component/integration tests, Playwright only if browser-only behavior proves untestable at lower layers  
**Target Platform**: Authenticated web application dialog on supported desktop and laptop viewports, resilient down to smaller supported screens  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: Preserve current comparison-detail request count, keep initial dialog rendering within the existing single-detail fetch flow, and keep 2-6 participant comparisons readable without secondary navigation  
**Constraints**: Preserve existing dialog shell/history/loading/error states, use semantic Tailwind tokens only, avoid dynamic Tailwind classes, keep one deterministic winner hero, expose neutral states for pending/unavailable data, and keep row labels understandable during horizontal scrolling  
**Scale/Scope**: One existing dialog flow, three existing comparison read endpoints, 2-6 participants per comparison, and a frontend-focused redesign across the comparison component set

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status |
|-----------|-------------|--------|
| I. TypeScript-First Development | Continue using strict typed comparison payloads and explicit component props; no `any` needed | ✅ PASS |
| II. Component-Driven Architecture | Redesign within existing `components/comparison/` feature area using shadcn/ui primitives and client-component boundaries already required by the dialog | ✅ PASS |
| III. Test-Driven Development | Cover payload invariants with integration tests and redesign behavior with component tests; E2E only if sticky-column or keyboard-only behavior cannot be validated lower in the stack | ✅ PASS |
| IV. Security-First Design | No new trust boundary; existing Zod-validated GET routes and ticket authorization remain authoritative | ✅ PASS |
| V. Database Integrity | No Prisma schema or write-path changes; existing comparison persistence remains unchanged | ✅ PASS |
| VI. AI-First Development Model | All design artifacts remain under `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/` | ✅ PASS |

**Gate Status**: PASS - No constitutional violations or unresolved clarifications remain after repository review.

## Project Structure

### Documentation (this feature)

```
/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── comparison-dashboard-api.yaml
└── tasks.md
```

### Source Code (repository root)

```
/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/
├── route.ts
├── check/route.ts
└── [comparisonId]/route.ts

/home/runner/work/ai-board/ai-board/target/components/comparison/
├── comparison-viewer.tsx
├── comparison-ranking.tsx
├── comparison-metrics-grid.tsx
├── comparison-operational-metrics.tsx
├── comparison-compliance-grid.tsx
├── comparison-decision-points.tsx
├── comparison-quality-popover.tsx
└── types.ts

/home/runner/work/ai-board/ai-board/target/hooks/
└── use-comparisons.ts

/home/runner/work/ai-board/ai-board/target/lib/
├── comparison/comparison-detail.ts
├── quality-score.ts
└── types/comparison.ts

/home/runner/work/ai-board/ai-board/target/tests/
├── integration/comparisons/
└── unit/components/
```

**Structure Decision**: Use the existing Next.js web-app layout and keep the redesign inside the current comparison feature modules. Backend work is limited to contract confirmation and regression coverage around existing GET endpoints; the main implementation surface is the `components/comparison/` client UI and its tests.

## Complexity Tracking

No constitution violations require justification.

## Phase 0: Research

Phase 0 resolved these design questions in `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/research.md`:

1. How the winner should remain unambiguous while preserving current ranking authority
2. How to keep 2-6 participants visible without pagination or drill-down
3. How to merge headline and detailed metrics without losing the quality-score popover
4. How compliance and decision cues should expose pass/mixed/fail/missing states accessibly
5. How to represent pending and unavailable enrichment data consistently
6. How to stay within semantic token and existing endpoint constraints

## Phase 1: Design & Contracts

### Data Model

The design reuses the existing comparison detail payload and formalizes the frontend view model in `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/data-model.md`. No database entities or Prisma schema changes are required.

### API Contracts

The comparison dialog continues to rely on the existing read endpoints, documented in `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/contracts/comparison-dashboard-api.yaml`:

- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/check`
- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons?limit={limit}`
- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}`

### Quickstart

Implementation sequencing, affected files, and validation commands are documented in `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/quickstart.md`.

## Testing Strategy

| User Story | Primary Test Type | Planned Coverage |
|-----------|-------------------|------------------|
| Story 1: winner hero and immediate scanability | Component test | Extend `tests/unit/components/` around ranking/viewer sections to verify hero dominance, winner metadata absorption, and headline metrics in the initial layout |
| Story 2: all participants visible and ranked | Component test | Add 2/4/6 participant rendering cases to verify one-session visibility, ranking order, and score-band treatments |
| Story 3: unified relative metrics | Component test + integration regression | Component tests for merged matrix and sticky label behavior; keep integration coverage for detail payload shape and best-value flags |
| Story 4: compliance and decision verdict cues | Component test | Extend comparison dashboard section tests for pass/mixed/fail/missing treatments, first decision default-open behavior, and visible summaries |
| Existing comparison APIs | Integration test | Extend `tests/integration/comparisons/` to confirm existing detail/check/history routes continue returning the fields the redesign depends on |

Testing notes:
- Search and extend existing comparison tests first.
- API coverage remains in Vitest integration tests, not Playwright.
- Use RTL `getByRole` first for dialog, headings, buttons, and accordion triggers.
- Reserve Playwright for true browser-only gaps; none are required by the current design plan.

## Post-Design Constitution Re-Check

| Principle | Design Compliance | Status |
|-----------|-------------------|--------|
| I. TypeScript-First Development | Design stays on top of typed `ComparisonDetail`/component props and does not require weak typing | ✅ PASS |
| II. Component-Driven Architecture | Dashboard is composed from existing comparison feature components and shadcn/ui cards, dialog, badges, scroll areas, and collapsibles | ✅ PASS |
| III. Test-Driven Development | Design maps cleanly to component and integration tests in existing comparison suites | ✅ PASS |
| IV. Security-First Design | No auth, validation, or data-exposure regressions introduced; existing protected routes remain in place | ✅ PASS |
| V. Database Integrity | No schema or transaction changes introduced by the redesign | ✅ PASS |
| VI. AI-First Development Model | Only spec-folder artifacts were generated during planning | ✅ PASS |

**Post-Design Gate Status**: PASS - Ready for task generation.

## Generated Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Research | `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/research.md` | Records design decisions and tradeoffs |
| Data Model | `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/data-model.md` | Defines reused frontend payload entities and UI state rules |
| API Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/contracts/comparison-dashboard-api.yaml` | Documents existing comparison read APIs relied on by the redesign |
| Quickstart | `/home/runner/work/ai-board/ai-board/target/specs/AIB-355-redesign-comparison-dialog/quickstart.md` | Provides implementation order and validation checklist |

## Next Step

Run the task-generation workflow to break this plan into implementation tasks.
