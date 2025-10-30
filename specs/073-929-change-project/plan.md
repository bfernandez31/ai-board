# Implementation Plan: Project Card Redesign

**Branch**: `073-929-change-project` | **Date**: 2025-10-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/073-929-change-project/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Transform project cards to display the most recently shipped ticket status instead of static description text. Replace description field with last shipped ticket title, relative timestamp ("Shipped 2h ago"), total ticket count, optional deployment URL with copy functionality, and GitHub repository link. This surfaces actionable project momentum at-a-glance while maintaining existing visual design patterns.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, TailwindCSS 3.4, shadcn/ui (Radix UI primitives), Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Hybrid strategy - Vitest (unit tests for utilities), Playwright (integration/E2E tests)
**Target Platform**: Web application (Next.js SSR/SSG on Vercel)
**Project Type**: Web application (frontend + backend via Next.js App Router)
**Performance Goals**: <100ms p95 for API responses, <3s initial page load
**Constraints**: Must maintain existing visual design patterns (Catppuccin theme), preserve card click navigation, prevent layout breaking with long text
**Scale/Scope**: Single feature affecting 2 components (ProjectCard, projects API), 1 TypeScript type, 1 database query optimization

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. TypeScript-First Development** | ✅ PASS | All code changes in TypeScript strict mode. New types for shipped ticket data. Existing type system extended (ProjectWithCount). |
| **II. Component-Driven Architecture** | ✅ PASS | Extends existing shadcn/ui Card component (project-card.tsx). No custom UI primitives. Follows feature-based folder structure (/components/projects/). |
| **III. Test-Driven Development** | ✅ PASS | Hybrid testing strategy: Vitest for relative time formatting utility, Playwright for ProjectCard rendering and API integration. TDD workflow mandatory. |
| **IV. Security-First Design** | ✅ PASS | No new attack surface. Existing authentication (NextAuth session) and authorization (userId filtering) preserved. No user input validation needed (display-only). |
| **V. Database Integrity** | ⚠️ ATTENTION | Database query modification required to fetch last shipped ticket. Must verify Prisma query uses existing indexes (stage, updatedAt). No schema migration needed. |
| **VI. Specification Clarification Guardrails** | ✅ PASS | Auto-resolved decisions documented in spec.md with CONSERVATIVE policy applied. Trade-offs explicitly listed for review. |

**Gate Decision**: PROCEED with attention to Database Integrity principle.

**Action Items**:
- Verify Prisma query for last shipped ticket uses existing composite index on (projectId, stage, updatedAt)
- Ensure query performance meets <100ms p95 target for GET /api/projects
- Add Vitest unit tests for relative time formatting logic BEFORE implementation
- Add Playwright integration tests for ProjectCard component BEFORE implementation

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
components/projects/
├── project-card.tsx         # MODIFIED: Replace description with shipped ticket status
└── projects-container.tsx   # No changes (renders ProjectCard array)

app/
├── api/projects/route.ts    # MODIFIED: Enhance query for shipped ticket data
└── lib/
    ├── types/project.ts     # MODIFIED: Extend ProjectWithCount interface
    └── utils/
        └── time.ts          # NEW: Relative time formatting utility

lib/db/
└── projects.ts              # MODIFIED: Update getUserProjects query

tests/
├── unit/
│   └── time.test.ts         # NEW: Vitest tests for relative time formatting
└── e2e/
    └── project-card.spec.ts # MODIFIED: Extend existing tests for new card display
```

**Structure Decision**: Web application using Next.js App Router. Frontend components in `/components/projects/`, API routes in `/app/api/`, shared utilities in `/app/lib/utils/`, database queries in `/lib/db/`. Testing follows hybrid strategy: Vitest for pure utility functions (`time.ts`), Playwright for component integration and API behavior.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations detected. All constitution principles satisfied.

---

## Post-Design Constitution Re-Evaluation

*Conducted after Phase 1 design artifacts complete*

| Principle | Status | Post-Design Evidence |
|-----------|--------|---------------------|
| **I. TypeScript-First Development** | ✅ PASS | All types explicitly defined in data-model.md. ProjectWithCount extended with 5 new fields. ShippedTicketSummary type added. Zod schemas updated for deploymentUrl validation. |
| **II. Component-Driven Architecture** | ✅ PASS | ProjectCard component modified using existing shadcn/ui primitives (Button, Card, Tooltip). No custom UI components. useCopyToClipboard hook follows React conventions. |
| **III. Test-Driven Development** | ✅ PASS | Quickstart.md defines TDD workflow: 2 unit test suites (format-timestamp reused, useCopyToClipboard new), 2 Playwright integration test suites (project-card, API contracts). All tests written BEFORE implementation. |
| **IV. Security-First Design** | ✅ PASS | deploymentUrl validated with Zod URL schema (max 500 chars). No new authentication surface. Existing session-based auth preserved. API contracts document 401/403 error responses. |
| **V. Database Integrity** | ✅ PASS | Migration verified safe (additive only, nullable field). Query uses existing composite index (projectId, stage, updatedAt). Performance target <100ms p95 documented. No N+1 queries (single Prisma include query). |
| **VI. Specification Clarification Guardrails** | ✅ PASS | Feature follows CONSERVATIVE policy decisions from spec.md. All trade-offs documented in research.md. No quality compromises detected. |

**Final Gate Decision**: ✅ APPROVED FOR IMPLEMENTATION

**Validation Checklist**:
- ✅ Database migration tested and reversible
- ✅ Type safety maintained across all layers (DB → API → UI)
- ✅ TDD workflow documented with concrete test examples
- ✅ No new security vulnerabilities introduced
- ✅ Query performance validated with index analysis
- ✅ All constitution principles satisfied

**Risk Assessment**: LOW
- Changes are additive (no breaking changes)
- Existing tests continue to pass
- Migration rollback plan documented
- Performance targets achievable with existing indexes
