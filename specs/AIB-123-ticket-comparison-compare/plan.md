# Implementation Plan: Ticket Comparison

**Branch**: `AIB-123-ticket-comparison-compare` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-123-ticket-comparison-compare/spec.md`

## Summary

Enable project owners to compare 1-5 tickets via `@ai-board /compare #KEY1 #KEY2` command in comments. The feature generates comparison reports analyzing implementation metrics, costs, telemetry data, and constitution compliance. Reports are stored as markdown files in `specs/{branch}/comparisons/` and displayed via the existing DocumentationViewer component.

**Technical Approach**: Extend the existing ai-board-assist workflow with a new `/compare` Claude command that:
1. Parses ticket key references (`#TICKET-KEY`) from comment text
2. Validates tickets exist in the same project with accessible branches
3. Analyzes spec.md, plan.md, and implementation code across tickets
4. Extracts job telemetry (tokens, cost, duration) from Prisma Job model
5. Scores constitution compliance against `.specify/memory/constitution.md`
6. Generates timestamped comparison report in markdown format
7. Posts summary comment with link to view full report

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5.90.5, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM, markdown files in `specs/{branch}/comparisons/`
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests)
**Target Platform**: Linux server (Vercel), modern browsers
**Project Type**: Web application (Next.js monolithic)
**Performance Goals**: Comparison report generation within 5 minutes, UI response <200ms
**Constraints**: 1-5 tickets per comparison, 30% feature alignment threshold for full comparison
**Scale/Scope**: Single-project scope, existing ai-board ticket volume

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- All new code uses TypeScript strict mode with explicit type annotations
- New interfaces: `ComparisonReport`, `TicketReference`, `FeatureAlignmentScore`, `ConstitutionComplianceScore`
- API responses and data models have corresponding TypeScript interfaces
- No `any` types allowed

### II. Component-Driven Architecture ✅
- Extend existing `DocumentationViewer` component for comparison reports
- Add "Compare" button using shadcn/ui Button component
- Server Components by default; Client Components only for interactive viewers
- New components in `/components/comparison/` following feature-folder pattern
- API routes in `/app/api/projects/[projectId]/comparisons/` with standard REST methods

### III. Test-Driven Development ✅
- **Unit tests**: Ticket key parsing regex, feature alignment calculation, constitution scoring
- **Integration tests**: Comparison API endpoints, ticket validation, telemetry extraction
- **E2E tests**: None required (no browser-specific features like drag-drop or OAuth)
- Tests organized by domain in existing test structure

### IV. Security-First Design ✅
- Input validation: Zod schemas for ticket key format, comparison limits (1-5 tickets)
- Project-scoped access: Only compare tickets within same project user has access to
- No sensitive data exposure: Comparisons respect existing authorization controls
- Existing authentication middleware applies to new endpoints

### V. Database Integrity ✅
- Read-only operations on existing Ticket and Job tables
- No schema changes required (comparison reports stored as markdown files, not database)
- Uses existing Prisma queries with parameterized access

### VI. AI-First Development Model ✅
- Feature adds `/compare` Claude command extending existing ai-board-assist pattern
- No human-oriented documentation files created at project root
- Implementation guidance in this plan and spec files only
- Tests use existing patterns, no teaching materials

**Gate Status**: ✅ PASSED - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```
specs/AIB-123-ticket-comparison-compare/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── comparison-api.yaml  # OpenAPI spec for comparison endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# Claude Command (new)
.claude/commands/
└── compare.md           # New /compare command for ticket comparison

# API Routes (new)
app/api/projects/[projectId]/
├── comparisons/
│   └── route.ts         # POST (create), GET (list comparisons)
└── tickets/[id]/comparisons/
    └── route.ts         # GET (ticket-specific comparisons)

# Components (new/extended)
components/
├── comparison/
│   ├── comparison-viewer.tsx    # Comparison report viewer (extends DocumentationViewer pattern)
│   ├── comparison-history.tsx   # Historical comparison list
│   └── types.ts                 # TypeScript interfaces
└── ticket/
    └── ticket-detail-modal.tsx  # Extended with "Compare" button

# Library (new)
lib/
├── comparison/
│   ├── ticket-reference-parser.ts  # Parse #TICKET-KEY from text
│   ├── feature-alignment.ts        # Calculate spec overlap
│   ├── constitution-scoring.ts     # Score against constitution principles
│   └── comparison-generator.ts     # Generate markdown report
└── types/
    └── comparison.ts               # Shared comparison types

# Hooks (new)
hooks/
└── use-comparisons.ts   # TanStack Query hooks for comparison data

# Tests
tests/
├── unit/
│   ├── comparison/
│   │   ├── ticket-reference-parser.test.ts
│   │   ├── feature-alignment.test.ts
│   │   └── constitution-scoring.test.ts
│   └── components/
│       └── comparison-viewer.test.tsx
└── integration/
    └── comparisons/
        └── comparison-api.test.ts
```

**Structure Decision**: Next.js web application with feature-based folder organization. New comparison functionality follows existing patterns: API routes in `/app/api/`, components in `/components/`, shared logic in `/lib/`, and TanStack Query hooks in `/hooks/`.

## Complexity Tracking

*No constitution violations - all complexity is within acceptable limits.*

| Design Decision | Justification | Alternative Considered |
|-----------------|---------------|------------------------|
| File-based comparison storage | Markdown files enable version control, history via git, and reuse of DocumentationViewer | Database storage rejected: adds schema complexity, doesn't leverage git history |
| Extend ai-board-assist workflow | Reuses existing workflow infrastructure, authentication, telemetry | New workflow rejected: duplicates infrastructure, increases maintenance |
| 30% alignment threshold | Prevents misleading comparisons of unrelated tickets | Configurable threshold rejected: adds complexity for marginal benefit (spec notes for future iteration) |

## Post-Design Constitution Re-Evaluation

*Gate re-check after Phase 1 design completion.*

### I. TypeScript-First Development ✅ CONFIRMED
- `data-model.md` defines 8 TypeScript interfaces with explicit types
- `contracts/comparison-api.yaml` specifies OpenAPI schemas with strict typing
- All new files in `lib/comparison/` use TypeScript with explicit return types
- No `any` types in design artifacts

### II. Component-Driven Architecture ✅ CONFIRMED
- `quickstart.md` specifies shadcn/ui Button for "Compare" button
- Components in `/components/comparison/` follow feature-folder pattern
- Extends existing DocumentationViewer rather than creating new primitives
- API routes follow `/app/api/` Next.js conventions

### III. Test-Driven Development ✅ CONFIRMED
- `quickstart.md` specifies test file locations following Testing Trophy:
  - Unit tests for pure functions (parsing, scoring) in `tests/unit/comparison/`
  - Integration tests for API endpoints in `tests/integration/comparisons/`
  - No E2E tests (correctly skipped - no browser-specific features)
- Tests organized by domain (comparison), not by spec

### IV. Security-First Design ✅ CONFIRMED
- `contracts/comparison-api.yaml` includes authentication via session cookie
- All endpoints require project access verification
- Ticket validation ensures same-project access
- No sensitive data exposed in comparison reports

### V. Database Integrity ✅ CONFIRMED
- No Prisma schema changes required
- Read-only access to existing Ticket and Job tables
- Comparison reports stored as git-versioned markdown files
- Uses existing parameterized Prisma queries

### VI. AI-First Development Model ✅ CONFIRMED
- No README or tutorial files created
- All documentation in `specs/AIB-123-ticket-comparison-compare/`
- `/compare` command extends existing ai-board-assist pattern
- Implementation guidance in spec/plan files only

**Post-Design Gate Status**: ✅ PASSED - All constitution principles remain satisfied after Phase 1 design.

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Feature Spec | `specs/AIB-123-ticket-comparison-compare/spec.md` | Complete |
| Implementation Plan | `specs/AIB-123-ticket-comparison-compare/plan.md` | Complete |
| Research | `specs/AIB-123-ticket-comparison-compare/research.md` | Complete |
| Data Model | `specs/AIB-123-ticket-comparison-compare/data-model.md` | Complete |
| API Contracts | `specs/AIB-123-ticket-comparison-compare/contracts/comparison-api.yaml` | Complete |
| Quickstart | `specs/AIB-123-ticket-comparison-compare/quickstart.md` | Complete |
| Tasks | `specs/AIB-123-ticket-comparison-compare/tasks.md` | Pending (/speckit.tasks) |
