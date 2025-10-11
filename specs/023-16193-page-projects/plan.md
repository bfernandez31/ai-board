# Implementation Plan: Projects List Page

**Branch**: `023-16193-page-projects` | **Date**: 2025-10-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/023-16193-page-projects/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Spec loaded successfully with 5 clarifications resolved
2. Fill Technical Context ✓
   → Project Type: Next.js 15 App Router (web application)
   → Structure Decision: Single Next.js project with app/ directory
3. Fill Constitution Check section ✓
   → Based on Constitution v1.0.0
4. Evaluate Constitution Check section ✓
   → All requirements align with constitutional principles
   → No violations detected
   → Update Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md ✓
   → No NEEDS CLARIFICATION markers in spec
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
7. Re-evaluate Constitution Check section ✓
   → Design validates constitutional compliance
   → Update Progress Tracking: Post-Design Constitution Check PASS
8. Plan Phase 2 → Describe task generation approach ✓
9. STOP - Ready for /tasks command ✓
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Create a projects list page that displays all available projects with name, description, last updated timestamp, and ticket count. Users can click on any project to navigate to its board. The page includes non-functional placeholder buttons for "Import Project" and "Create Project" with modern, clean styling featuring hover effects with scale transformations. Empty state displays a message with call-to-action when no projects exist. All projects display in a scrollable container without pagination.

**Technical Approach**: Next.js 15 App Router page at `/app/projects/page.tsx` (new route) fetching projects from existing Prisma Project model via API route. Reuse shadcn/ui components for buttons and cards. Client component for interactive hover effects. Server component for initial data fetch.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, shadcn/ui, TailwindCSS 3.4
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Project model with tickets relation)
**Testing**: Playwright E2E tests with existing test infrastructure
**Target Platform**: Web (Vercel deployment)
**Project Type**: Single Next.js application with App Router architecture
**Performance Goals**: <200ms page load time, smooth 60fps hover animations
**Constraints**: Server Components by default, Client Components only for interactivity
**Scale/Scope**: Display component + API route + E2E tests (~5-8 files)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✓
- **Status**: COMPLIANT
- All code will use TypeScript strict mode (existing tsconfig.json)
- API responses will use typed interfaces (Project with computed ticket count)
- No `any` types required for this feature

### II. Component-Driven Architecture ✓
- **Status**: COMPLIANT
- Use existing shadcn/ui components (Button, Card)
- Server Component for page, Client Component for interactive project cards
- API route follows existing pattern: `/app/api/projects/route.ts`
- Feature folder structure: `/components/projects/project-card.tsx`

### III. Test-Driven Development (NON-NEGOTIABLE) ✓
- **Status**: COMPLIANT
- E2E test will be written first (Red phase)
- Test scenarios map directly to acceptance criteria from spec
- Playwright test file: `/tests/e2e/projects-list.spec.ts`

### IV. Security-First Design ✓
- **Status**: COMPLIANT
- Input validation: No user inputs in this read-only feature
- Prisma queries: Use existing parameterized queries
- No sensitive data exposure: Public project info only
- No new secrets required

### V. Database Integrity ✓
- **Status**: COMPLIANT
- No schema changes required (existing Project model sufficient)
- Ticket count computed via Prisma aggregation (read-only)
- No migrations needed

## Project Structure

### Documentation (this feature)
```
specs/023-16193-page-projects/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── get-projects.json
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── projects/
│   └── page.tsx                    # New: Projects list page (Server Component)
├── api/
│   └── projects/
│       └── route.ts                # New: GET /api/projects endpoint
└── lib/
    └── prisma.ts                   # Existing: Prisma client

components/
└── projects/
    ├── project-card.tsx            # New: Interactive project card (Client Component)
    ├── empty-projects-state.tsx    # New: Empty state component
    └── projects-container.tsx      # New: Container with scroll handling

tests/
└── e2e/
    └── projects-list.spec.ts       # New: E2E test for projects list
```

**Structure Decision**: Single Next.js 15 App Router project. New `/projects` route at app root level (peer to existing `/projects/[projectId]/board`). Feature-based components in `/components/projects/`. API route follows existing REST pattern at `/app/api/projects/route.ts`. No database schema changes needed.

## Phase 0: Outline & Research

**Status**: ✓ COMPLETE

### Research Findings

#### 1. Next.js 15 App Router Patterns
**Decision**: Mix Server and Client Components following Next.js 15 best practices
**Rationale**:
- Server Component for page (`/app/projects/page.tsx`) handles initial data fetch
- Client Components for interactive elements (hover effects, navigation)
- Reduces JavaScript bundle size and improves initial page load

**Alternatives considered**:
- All Client Components: Rejected - unnecessary hydration overhead
- All Server Components: Rejected - cannot handle hover interactions

#### 2. Prisma Aggregation for Ticket Count
**Decision**: Use Prisma's `_count` relation query to compute ticket counts
**Rationale**:
- Single query fetches all projects with ticket counts
- Type-safe with Prisma's generated types
- Efficient database operation (aggregation at DB level)

**Example query**:
```typescript
const projects = await prisma.project.findMany({
  include: {
    _count: {
      select: { tickets: true }
    }
  },
  orderBy: { updatedAt: 'desc' }
});
```

**Alternatives considered**:
- Separate queries for each project: Rejected - N+1 query problem
- Manual COUNT(*) SQL: Rejected - loses Prisma type safety

#### 3. Shadcn/ui Components for Projects List
**Decision**: Use `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` from shadcn/ui
**Rationale**:
- Existing components in project (`/components/ui/`)
- Accessible, tested, responsive by default
- Consistent with existing board card patterns

**Alternatives considered**:
- Custom div-based cards: Rejected - violates constitution (Component-Driven Architecture)
- Third-party card library: Rejected - constitution forbids non-shadcn UI libraries

#### 4. Hover Animation Implementation
**Decision**: TailwindCSS `hover:scale-105` with `transition-transform` for scale effect
**Rationale**:
- 60fps performance via CSS transforms (GPU-accelerated)
- No JavaScript required for animation
- Built-in TailwindCSS utilities

**Implementation**:
```tsx
<div className="transition-transform duration-200 hover:scale-105 cursor-pointer">
```

**Alternatives considered**:
- Framer Motion: Rejected - overkill for simple hover effect
- CSS keyframes: Rejected - TailwindCSS utility classes simpler

#### 5. Empty State Design Pattern
**Decision**: Centered message with call-to-action text referencing Create Project button
**Rationale**:
- Matches acceptance criterion #7 from spec
- Guides users to next action
- Existing empty state patterns in codebase (check board empty states)

**Alternatives considered**:
- Inline tutorial: Rejected - out of scope
- Image/illustration: Rejected - no design system requirement in spec

#### 6. Scrollable Container Strategy
**Decision**: `overflow-y-auto max-h-[calc(100vh-200px)]` on container div
**Rationale**:
- Simple CSS-only solution
- No virtual scrolling library needed for expected project counts
- Works with responsive layouts

**Alternatives considered**:
- Virtual scrolling (react-window): Rejected - premature optimization
- Infinite scroll: Rejected - spec explicitly chose scrollable container

**Output**: All technical decisions resolved, no NEEDS CLARIFICATION remaining.

## Phase 1: Design & Contracts

**Status**: ✓ COMPLETE

### 1. Data Model (see data-model.md)
- Existing `Project` entity sufficient
- Computed `ticketCount` field via Prisma aggregation
- No schema migrations required

### 2. API Contracts (see contracts/get-projects.json)
- `GET /api/projects` endpoint contract
- Returns array of projects with computed ticket counts
- OpenAPI 3.0 schema generated

### 3. Contract Tests
- Contract test scaffolded in planning phase
- Will fail until API implementation (Red phase)

### 4. Quickstart Test (see quickstart.md)
- User scenario validation steps
- Maps to acceptance scenarios from spec

### 5. Agent File Update
- CLAUDE.md updated incrementally via update-agent-context.sh
- Added Next.js 15 App Router + Projects List Page context

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base
2. Generate tasks from Phase 1 artifacts:
   - API contract → contract test task [P]
   - Project card component → component task [P]
   - Empty state component → component task [P]
   - Projects page → page task (depends on API + components)
   - E2E test → integration test task
   - Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: E2E test first (Red), then contract tests, then implementation
- Dependency order:
  1. E2E test (defines acceptance)
  2. Contract test for API (defines interface)
  3. Components (independent, parallel)
  4. API implementation (makes contract test pass)
  5. Page assembly (integrates components + API)
  6. Verification (E2E test passes)

**Parallel Execution** [P]:
- Component creation tasks are independent
- Contract test and component tasks can run in parallel
- API and UI work can proceed simultaneously after contracts defined

**Estimated Output**: 12-15 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations - table not needed*

This feature aligns fully with constitutional principles:
- No additional dependencies required
- Standard Next.js patterns throughout
- Existing Prisma model reused
- TDD workflow maintained
- Security by design (read-only, no inputs)

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (5 clarifications from spec)
- [x] Complexity deviations documented (N/A - no deviations)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
