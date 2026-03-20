# Implementation Plan: Replace PR Comments Dimension with Spec Sync in Code Review

**Branch**: `AIB-321-replace-pr-comments` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-321-replace-pr-comments/spec.md`

## Summary

Replace the existing `PR Comments` review dimension with a new zero-weight `Spec Sync` dimension that evaluates only specification files changed in the current pull request. The plan centralizes dimension metadata in one shared configuration used by score computation, verify output storage, ticket review breakdowns, and analytics aggregation so new reviews show `Spec Sync` consistently while historical reviews that still contain `PR Comments` remain readable.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, Vitest, Playwright, Zod, GitHub Actions workflows
**Storage**: PostgreSQL via Prisma `Job.qualityScore` and `Job.qualityScoreDetails` fields; no schema migration required
**Testing**: Vitest unit, component, and integration tests; no new E2E coverage expected
**Target Platform**: Web application plus GitHub Actions driven VERIFY workflow
**Project Type**: Full-stack Next.js application with workflow-managed review automation
**Performance Goals**: Preserve existing verify-job completion timing and analytics query behavior; keep no-spec PRs as constant-time success path for Spec Sync scoring
**Constraints**: No breaking schema changes; preserve historical review record interpretability; use one shared dimension configuration for scoring and display; only files under `specs/specifications/` are in scope for Spec Sync
**Scale/Scope**: Review command prompt, verify workflow score ingestion, shared quality-score utilities, ticket review UI, analytics aggregation/chart display, and associated tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- **Status**: PASS
- **Evidence**: Current score utilities, analytics queries, API routes, and tests are already strict TypeScript files
- **This feature**: Adds typed shared dimension metadata and preserves typed `qualityScoreDetails` parsing
- **No violations**: No `any`, no untyped JSON contract changes

### II. Component-Driven Architecture ✅
- **Status**: PASS
- **Evidence**: Ticket review display and analytics already consume shared library helpers from `lib/` and render through existing components
- **This feature**: Keeps review-dimension logic in shared utilities and updates existing display components instead of introducing duplicate hardcoded lists
- **No violations**: No new UI primitives or route structure changes

### III. Test-Driven Development (NON-NEGOTIABLE) ✅
- **Status**: PASS
- **Evidence**: Existing unit/component/integration coverage already exercises quality-score utilities, ticket review UI, analytics aggregation, and job status persistence
- **This feature**: Extends existing tests first rather than adding browser-only coverage
- **Action**: Update unit tests for shared dimension config and score exclusion, component tests for `Spec Sync` visibility, and integration tests for analytics/job persistence

### IV. Security-First Design ✅
- **Status**: PASS
- **Evidence**: No new public input surfaces beyond existing workflow-authenticated score ingestion and PR review automation
- **This feature**: Restricts Spec Sync scope to changed specification files and keeps `PATCH /api/jobs/[id]/status` validation unchanged except for payload contents
- **No violations**: No secrets handling changes, no raw SQL, no new user-auth logic

### V. Database Integrity ✅
- **Status**: PASS
- **Evidence**: Existing `Job.qualityScoreDetails` string column already stores per-dimension JSON
- **This feature**: Reuses the existing schema and preserves backward compatibility for historical records containing `PR Comments`
- **No violations**: No Prisma migration required

### VI. Specification Clarification Guardrails ✅
- **Status**: PASS
- **Evidence**: The feature spec documents conservative decisions for zero-weight visibility, changed-spec scope, and reporting continuity
- **This feature**: Uses those documented trade-offs directly in the design artifacts
- **No violations**: No unresolved clarification is required to begin design

**GATE VERDICT**: ✅ PASS - All constitution principles satisfied. Proceed to Phase 0.

### Post-Design Re-Evaluation (After Phase 1)

**Re-evaluation Date**: 2026-03-20 (after research.md, data-model.md, contracts, quickstart.md generated)

#### I. TypeScript-First Development ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: `data-model.md` and `contracts/quality-score-dimensions.yaml` define typed score payload shapes and shared config responsibilities
- **Implementation**: Planned changes stay inside existing strict TypeScript modules and typed test fixtures

#### II. Component-Driven Architecture ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: `quickstart.md` routes all dimension metadata through shared `lib/quality-score.ts` helpers consumed by ticket and analytics components
- **Implementation**: UI updates are constrained to existing review-display components

#### III. Test-Driven Development ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: `quickstart.md` assigns unit, component, and integration coverage per user story using the project’s test decision tree
- **Implementation**: No browser-required behavior was identified, so E2E is intentionally excluded

#### IV. Security-First Design ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: `research.md` limits Spec Sync evaluation to PR-modified files in `specs/specifications/` and keeps workflow-authenticated job updates unchanged
- **Implementation**: No new attack surface or elevated permissions introduced

#### V. Database Integrity ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: `data-model.md` confirms existing `Job` storage is sufficient for both `Spec Sync` and historical `PR Comments` data
- **Implementation**: No migration, transaction, or retention changes required

#### VI. Specification Clarification Guardrails ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: `research.md` resolves all design choices without weakening the spec’s conservative rollout constraints
- **Implementation**: Shared config and compatibility rules preserve observability and score continuity

**FINAL GATE VERDICT**: ✅ PASS - Design artifacts satisfy the constitution and are ready for Phase 2 task generation.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-321-replace-pr-comments/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── quality-score-dimensions.yaml
└── tasks.md                       # Phase 2 output, not created here
```

### Source Code (repository root)

```text
.claude-plugin/
├── commands/
│   └── ai-board.code-review.md    # MODIFY: replace PR Comments instructions and output JSON
└── scripts/bash/
    └── update-agent-context.sh    # RUN: refresh agent context from completed plan

.github/workflows/
└── verify.yml                     # VERIFY: continues parsing QUALITY_SCORE_JSON output

lib/
├── quality-score.ts               # MODIFY: shared dimension configuration and weighted-score helpers
├── analytics/
│   ├── queries.ts                 # MODIFY: analytics dimension aggregation ordering/metadata usage
│   └── types.ts                   # VERIFY: existing types remain sufficient or get narrow additions
└── types/
    └── job-types.ts               # VERIFY: stored details shape remains compatible

components/
├── ticket/
│   └── quality-score-section.tsx  # MODIFY: render shared/new dimension labels consistently
└── analytics/
    └── dimension-comparison-chart.tsx  # VERIFY/MODIFY: display updated dimension labels and weight ordering

app/
├── api/jobs/[id]/status/route.ts  # VERIFY: quality score persistence remains backward compatible
└── lib/job-update-validator.ts    # VERIFY: payload validation already permits updated detail JSON

tests/
├── unit/
│   └── quality-score.test.ts      # MODIFY: shared config and zero-weight scoring coverage
├── unit/components/
│   └── quality-score-section.test.tsx  # MODIFY: Spec Sync display coverage
└── integration/
    ├── analytics/quality-score.test.ts # MODIFY: analytics replacement and historical compatibility
    └── jobs/status.test.ts             # MODIFY: persisted details allow zero-weight Spec Sync dimension
```

## Phase 0: Outline & Research

### Unknowns Extracted From Technical Context

1. Where should dimension names, weights, activation, and ordering live so scoring and display share one source of truth?
2. Which files currently produce the `qualityScoreDetails` JSON, and what must change to replace `PR Comments` with `Spec Sync`?
3. How should the system preserve interpretability for historical review records that still store `PR Comments`?
4. What is the lowest-risk way to scope Spec Sync to PR-modified files under `specs/specifications/` while treating no-spec PRs as success?

### Research Tasks Dispatched

1. App-consumer research: ticket quality score section, analytics aggregation, and tests that currently depend on dimension labels/weights.
2. Producer research: code review command and verify workflow score ingestion that currently emit hardcoded dimension JSON.
3. Compatibility research: historical `qualityScoreDetails` storage behavior and whether schema/API changes are required.

### Research Outcome

- `research.md` resolves all four unknowns.
- Shared dimension metadata belongs in `lib/quality-score.ts` and should drive score computation plus display ordering.
- Producer-side changes are isolated to `.claude-plugin/commands/ai-board.code-review.md`; verify workflow parsing in `.github/workflows/verify.yml` stays compatible because it treats the JSON payload opaquely.
- Historical jobs remain readable because analytics and ticket UI consume stored dimensions by name from JSON rather than requiring schema-level enum changes.

## Phase 1: Design & Contracts

### Design Artifacts

1. `data-model.md`
   - Defines shared review dimension configuration, persisted review result shape, and Spec Sync finding semantics.
   - Documents compatibility rules for historical `PR Comments` entries.
2. `contracts/quality-score-dimensions.yaml`
   - Documents the `QUALITY_SCORE_JSON` payload emitted by the code review command and persisted through `PATCH /api/jobs/[id]/status`.
   - Specifies zero-weight exclusion from overall score while keeping the dimension visible in stored details and analytics.
3. `quickstart.md`
   - Defines implementation order, concrete file targets, and validation steps.
   - Includes the testing strategy mapped to each user story using the repository decision tree.

### Testing Strategy

**User Story 1 - Review PRs Against Updated Specs**
- **Primary tests**: Unit tests for shared dimension metadata and score computation helpers.
- **Primary tests**: Integration coverage for persisted verify-job payloads containing `Spec Sync` results and no-spec success behavior.
- **Rationale**: The risk is in payload generation and storage semantics, not browser behavior.

**User Story 2 - Preserve Existing Quality Gate Behavior**
- **Primary tests**: Unit tests for weighted score computation excluding zero-weight dimensions.
- **Primary tests**: Integration tests confirming analytics and stored `qualityScore` values remain based only on active dimensions.
- **Rationale**: Pure computation plus API/database behavior fit unit and integration layers.

**User Story 3 - See the New Dimension Everywhere the Old One Appeared**
- **Primary tests**: Component tests for `QualityScoreSection`.
- **Primary tests**: Integration tests for analytics dimension comparison output.
- **Rationale**: Rendering behavior is component-level; analytics behavior is query-level.

**Search Existing Tests First**
- Extend `tests/unit/quality-score.test.ts`
- Extend `tests/unit/components/quality-score-section.test.tsx`
- Extend `tests/integration/analytics/quality-score.test.ts`
- Extend `tests/integration/jobs/status.test.ts`

### Agent Context Update

Run:

```bash
/home/runner/work/ai-board/ai-board/target/.claude-plugin/scripts/bash/update-agent-context.sh claude
```

Expected outcome:
- Update the agent context file with the current plan’s language/framework/project-type metadata.
- Preserve manual additions between markers.

## Complexity Tracking

No constitution violations or exceptions are required for this feature.
