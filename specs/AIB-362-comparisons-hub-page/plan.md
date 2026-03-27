# Implementation Plan: Comparisons Hub Page With Project List, Inline Detail, and VERIFY Launch

**Branch**: `AIB-362-comparisons-hub-page` | **Date**: 2026-03-27 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/spec.md`

## Summary

Add a project-scoped comparisons hub at `/projects/[projectId]/comparisons` that exposes saved comparison history from durable `ComparisonRecord` data, shows full comparison detail inline on the same page, and lets project members launch a new comparison from eligible VERIFY-stage tickets without typing `@ai-board /compare`. The launch flow reuses the existing AI-BOARD compare workflow by creating the same comment/job pattern the comment entry point already dispatches.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0, Next.js 16 (App Router), React 18
**Primary Dependencies**: Prisma 6.x, PostgreSQL 14+, TanStack Query v5.90.5, TailwindCSS 3.4, shadcn/ui, lucide-react, NextAuth.js
**Storage**: Reuse existing `ComparisonRecord`, `ComparisonParticipant`, `DecisionPointEvaluation`, `ComplianceAssessment`, `TicketMetricSnapshot`, `Ticket`, `Job`, and `Comment` models; no Prisma schema change planned
**Testing**: Vitest integration tests for project-scoped APIs and launch orchestration, Vitest component tests for hub interactions, Playwright not required unless responsive navigation behavior proves browser-dependent during implementation
**Target Platform**: Web application for desktop and mobile project workspaces
**Project Type**: Next.js App Router application
**Performance Goals**: Paginated history queries from indexed `ComparisonRecord` rows; inline detail loads on demand; 2s polling only while a newly launched comparison job is pending; no modal nesting or full-page navigation for detail inspection
**Constraints**: Must enforce project authorization on every endpoint; must preserve the existing ticket-detail comparison entry point; must reuse the existing compare workflow semantics; must use static Tailwind class strings and semantic color tokens only; must remain readable on mobile and desktop; must not introduce new UI or state libraries
**Scale/Scope**: 1 new project page, 3 new project-scoped comparison endpoints plus 1 rewrite of the existing project list endpoint, shared query hook updates, navigation update, and focused integration/component coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All planned work stays in strict TypeScript with typed route params, typed response contracts, and shared comparison interfaces |
| II. Component-Driven Architecture | PASS | New UI stays in existing project/comparison component folders and uses shadcn/ui primitives with App Router pages and API routes |
| III. Test-Driven Development | PASS | Plan assigns integration tests to API/database work and component tests to interactive page behavior; no feature is considered complete without passing coverage |
| IV. Security-First Design | PASS | Project access checks stay mandatory; launch endpoint validates ticket ownership/stage before dispatching workflow side effects |
| V. Database Integrity | PASS | Design intentionally reuses current Prisma models and existing `Job`/`Comment` transaction patterns instead of introducing ad hoc persistence |
| V. Spec Clarification Guardrails | PASS | Spec already documents conservative auto-resolved decisions; plan resolves implementation unknowns without changing product scope |
| VI. AI-First Development Model | PASS | All generated artifacts remain inside the feature spec directory or existing source folders; no root tutorial docs added |

**Gate Result**: ALL PASS - proceeding to Phase 0 research.

## Project Structure

### Documentation

```text
/home/runner/work/ai-board/ai-board/target/specs/AIB-362-comparisons-hub-page/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── comparisons-hub.openapi.yaml
```

### Source Code

```text
/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/comparisons/page.tsx              # NEW
/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/route.ts          # REWRITE list endpoint to use ComparisonRecord
/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/[comparisonId]/route.ts # NEW detail endpoint
/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/candidates/route.ts     # NEW VERIFY candidate endpoint
/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/launch/route.ts         # NEW launch endpoint
/home/runner/work/ai-board/ai-board/target/components/comparison/                                           # REUSE viewer pieces + add hub-specific client components
/home/runner/work/ai-board/ai-board/target/components/navigation/nav-items.ts                               # UPDATE add Comparisons nav item
/home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts                                          # EXTEND with project-scoped queries/mutation helpers
/home/runner/work/ai-board/ai-board/target/lib/comparison/                                                   # ADD project-scoped summary/detail/candidate helpers as needed
/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/                                    # ADD project hub API coverage
/home/runner/work/ai-board/ai-board/target/tests/unit/components/                                            # ADD/EXTEND hub page component tests
```

**Structure Decision**: Keep the existing ticket-scoped comparison APIs intact for the modal entry point, and add project-scoped routes for hub browsing so the page never has to infer an arbitrary participant ticket just to load one saved comparison.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1: Browse project comparisons | Integration test | `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparisons-route.test.ts` | API/database behavior: pagination, newest-first ordering, auth, and empty states belong in integration coverage |
| US2: Inspect a comparison inline | Integration test + component test | `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparison-detail-route.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/unit/components/project-comparisons-page.test.tsx` | Route verifies project-scoped detail retrieval; component test verifies inline selection/error transitions without modal behavior |
| US3: Launch a new comparison from VERIFY | Integration test + component test | `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/project-comparison-launch.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/unit/components/project-comparison-launch-sheet.test.tsx` | Launch orchestration touches auth, DB, job creation, and workflow dispatch; UI selection rules and empty/error states fit component tests |
| Navigation exposure | Component test | Extend sidebar/nav tests if present, otherwise add focused unit coverage for `/projects/[projectId]/comparisons` item | Prevent regressions in project navigation reachability |
| Regression: ticket modal comparison entry point | Integration test | Extend existing `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-api.test.ts` or related tests | Spec requires the current ticket-level flow to remain intact |

**Test selection summary**: No browser-only requirement has been identified. Default to integration tests for API/DB workflows and component tests for client interactions. Add E2E only if responsive inline detail or launch behavior cannot be validated adequately with existing component coverage.

## Complexity Tracking

*No constitution violations or exceptions are planned.*

## Implementation Approach

### Phase 0 Research Outcomes

1. Replace the legacy filesystem-based project history endpoint with Prisma-backed `ComparisonRecord` queries so project browsing and inline detail operate on the same durable source as the ticket modal.
2. Add dedicated project-scoped list/detail/candidate/launch routes instead of overloading ticket-scoped routes with arbitrary participant IDs.
3. Reuse the existing compare workflow by synthesizing the same comment/job dispatch path already used by comment submissions, with one selected VERIFY ticket acting as the deterministic source anchor.
4. Represent pending launch state with the created `Job` record and refresh hub queries when that job becomes terminal.

### Phase 1 Design

1. Data access layer
   - Build project-scoped comparison summary query with pagination from `ComparisonRecord`.
   - Build project-scoped detail loader that reuses the same normalization logic as `getComparisonDetailForTicket`, but authorizes by project rather than participant ticket.
   - Build VERIFY candidate query that returns ticket key, title, stage, updatedAt, and quality score state derived from latest verify jobs.
2. Launch orchestration
   - Validate user project access and that at least two selected tickets belong to the project and are currently in `VERIFY`.
   - Choose a deterministic source ticket from the selected set, create a user comment containing `@ai-board /compare ...`, create the matching `comment-verify` job, and dispatch `ai-board-assist.yml` through the existing workflow helper.
   - Return a `ComparisonLaunchRequest` payload with `jobId`, source ticket, selected ticket IDs, and initial `PENDING` status for client-side polling.
3. Hub UI
   - Add a project page with paginated summaries on the left/top and inline detail on the right/below depending on viewport.
   - Reuse `ComparisonViewer` dashboard content for the inline detail region rather than introducing a second detail renderer.
   - Add launch CTA, candidate selection sheet/panel, pending/error banners, and empty states for both history and candidates.
4. Navigation and hooks
   - Add a `Comparisons` destination to project navigation.
   - Extend comparison hooks with project list/detail/candidates/launch APIs and focused invalidation when launch jobs settle.

### Phase 2 Planning Output

Implementation can proceed without additional clarification. The main build sequence is:

1. Project-scoped comparison query/service layer and API contracts.
2. Launch orchestration endpoint reusing the comment workflow path.
3. Hub page, hooks, and navigation entry.
4. Integration/component regression coverage.

## Post-Design Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Contracts, hooks, and route helpers all remain explicitly typed; no `any` required |
| II. Component-Driven Architecture | PASS | Page composes existing comparison viewer components and shadcn/ui controls inside established folders |
| III. Test-Driven Development | PASS | Design maps each user story to integration/component coverage and preserves existing comparison regression tests |
| IV. Security-First Design | PASS | Every project route uses project access checks and validates selected tickets before workflow dispatch |
| V. Database Integrity | PASS | No schema drift introduced; launch side effects follow existing `Comment` + `Job` creation workflow patterns |
| V. Spec Clarification Guardrails | PASS | All implementation unknowns from planning are resolved in `research.md` with explicit decisions and alternatives |
| VI. AI-First Development Model | PASS | Generated docs stay inside the ticket spec directory only |

**Post-Design Gate Result**: ALL PASS - Phase 0 and Phase 1 artifacts are complete, ready for task generation.
