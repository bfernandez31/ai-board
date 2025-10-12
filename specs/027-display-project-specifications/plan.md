# Implementation Plan: Display Project Specifications

**Branch**: `027-display-project-specifications` | **Date**: 2025-10-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/b.fernandez/Workspace/ai-board/specs/027-display-project-specifications/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ No NEEDS CLARIFICATION - all resolved via /clarify
   → Detect Project Type: Web application (Next.js App Router)
   → Set Structure Decision: Next.js monorepo with app/ and components/
3. Fill the Constitution Check section
   → ✅ Constitution checks defined
4. Evaluate Constitution Check section
   → ✅ PASS - All constitutional principles satisfied
   → Update Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   → ✅ Research complete - leveraging existing patterns
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ Design artifacts generated
7. Re-evaluate Constitution Check section
   → ✅ PASS - Design complies with all principles
   → Update Progress Tracking: Post-Design Constitution Check PASS
8. Plan Phase 2 → Task generation approach described
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Add project name and documentation icon to board header with click-through to read-only specifications page displaying `/specs/specifications/README.md` from Git repository. Reuses existing markdown rendering (react-markdown + react-syntax-highlighter) and GitHub API integration pattern from ticket spec viewer.

## Technical Context
**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, react-markdown ^9.0.1, react-syntax-highlighter ^15.5.0, @octokit/rest ^22.0.0
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Project model)
**Testing**: Playwright with E2E tests
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (Next.js App Router monorepo)
**Performance Goals**: <200ms page load for specifications, <100ms API response for markdown fetch
**Constraints**: Read-only view (no editing), open in new tab, reuse existing spec-viewer patterns, no file size limits
**Scale/Scope**: Single project specification per project, ~50-200KB typical markdown file size

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- [x] All code in TypeScript strict mode with explicit types
- [x] No `any` types (use proper GitHub API types from @octokit/rest)
- [x] API routes and components fully typed

### II. Component-Driven Architecture
- [x] Reuse existing `components/board/spec-viewer.tsx` pattern
- [x] Server Components for page routes
- [x] Client Components only for interactive header icon
- [x] Shadcn/ui components for UI primitives (no custom styling)

### III. Test-Driven Development (NON-NEGOTIABLE)
- [x] E2E tests for navigation flow (click icon → new tab → view specs)
- [x] E2E tests for markdown rendering validation
- [x] Tests written before implementation (Red-Green-Refactor)

### IV. Security-First Design
- [x] Input validation via Zod for projectId parameter
- [x] Prisma parameterized queries for project lookup
- [x] No sensitive data exposed in API responses
- [x] GITHUB_TOKEN in environment variables only

### V. Database Integrity
- [x] Use existing Project model (no schema changes needed)
- [x] Read-only operations (no database writes)
- [x] Foreign key validation for projectId

**Initial Assessment**: ✅ PASS - All constitutional principles satisfied

## Project Structure

### Documentation (this feature)
```
specs/027-display-project-specifications/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── get-project-spec.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── projects/
│   └── [projectId]/
│       ├── board/
│       │   └── page.tsx              # ✏️ Update: Add project name + doc icon to header
│       └── specifications/
│           └── page.tsx              # ➕ New: Specifications page
├── api/
│   └── projects/
│       └── [projectId]/
│           └── spec/
│               └── route.ts          # ➕ New: GET /api/projects/:id/spec

components/
├── board/
│   ├── board.tsx                     # ✏️ Update: Pass project data to header
│   ├── board-header.tsx              # ➕ New: Header with project name + doc icon
│   └── spec-viewer.tsx               # 📖 Reference: Reuse markdown rendering logic
└── specifications/
    └── spec-page-content.tsx         # ➕ New: Client component for spec display

lib/
├── github/
│   └── spec-fetcher.ts               # ✏️ Extend: Add fetchProjectSpec function
└── db/
    └── projects.ts                   # 📖 Reference: Existing getProjectById

tests/
└── e2e/
    └── project-specifications.spec.ts # ➕ New: E2E tests
```

**Structure Decision**: Next.js App Router monorepo. Server Components for static pages (`app/projects/[projectId]/specifications/page.tsx`), Client Components for interactive UI (`components/board/board-header.tsx` icon click). API route at `/api/projects/[projectId]/spec` for specification retrieval. Reuses existing patterns from ticket spec viewer (components/board/spec-viewer.tsx) for markdown rendering and GitHub API integration (lib/github/spec-fetcher.ts).

## Phase 0: Outline & Research

No unknowns to research - all technical context resolved via clarification session. Leveraging existing patterns:

1. **Markdown Rendering**: Reuse react-markdown + react-syntax-highlighter setup from `components/board/spec-viewer.tsx`
2. **GitHub API Integration**: Extend `lib/github/spec-fetcher.ts` with project-scoped fetch function
3. **Routing Pattern**: Follow existing `/projects/[projectId]/board` pattern
4. **API Route Design**: Mirror `/api/projects/[projectId]/tickets/[id]/spec` structure

**Output**: research.md with design decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - No new database entities (uses existing Project model)
   - File system entity: ProjectSpecification (README.md at /specs/specifications/)
   - Relationship: Project (1) → ProjectSpecification (1)

2. **Generate API contracts** from functional requirements:
   - `GET /api/projects/:projectId/spec` → OpenAPI schema
   - Request: projectId (path parameter, integer)
   - Response: { content: string, metadata: object } or error
   - Error codes: 400 (invalid ID), 404 (not found), 500 (GitHub error)

3. **Generate contract tests** from contracts:
   - `tests/e2e/project-spec-api-contract.spec.ts` (must fail initially)
   - Assert response schema matches OpenAPI spec
   - Assert proper error handling

4. **Extract test scenarios** from user stories:
   - Scenario 1: Click doc icon → new tab opens → spec page renders
   - Scenario 2: Navigate directly to `/projects/:id/specifications` → spec displays
   - Scenario 3: Invalid markdown → error message displays
   - Quickstart validation: User can access project specs in 2 clicks

5. **Update CLAUDE.md incrementally**:
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
   - Add new technologies: None (reusing existing)
   - Update recent changes: Add entry for 027-display-project-specifications

**Output**: data-model.md, /contracts/get-project-spec.yaml, failing contract tests, quickstart.md, updated CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base
2. Generate tasks from Phase 1 artifacts:
   - Contract test tasks for API endpoint [P]
   - E2E test tasks for user scenarios [P]
   - Implementation tasks (TDD order: tests before code)
   - Integration tasks (wire components together)
   - Validation tasks (manual testing, accessibility check)

**Ordering Strategy**:
- **Tests First** (TDD): Contract tests → E2E tests → Implementation
- **Dependency Order**: API route → Spec fetcher → Page component → Header component
- **Parallel Markers [P]**: Independent test files can run in parallel
- **Sequential**: UI components depend on API route completion

**Estimated Task Breakdown** (15-20 tasks):
1. Contract test: GET /api/projects/:id/spec [P]
2. E2E test: Click doc icon opens new tab [P]
3. E2E test: Spec page renders markdown [P]
4. E2E test: Error handling for invalid markdown [P]
5. Implement: GET /api/projects/:id/spec route
6. Extend: lib/github/spec-fetcher.ts with fetchProjectSpec
7. Implement: app/projects/[projectId]/specifications/page.tsx
8. Implement: components/specifications/spec-page-content.tsx
9. Implement: components/board/board-header.tsx with doc icon
10. Update: components/board/board.tsx to include header
11. Update: app/projects/[projectId]/board/page.tsx to pass project data
12. Integration: Wire header → page → API flow
13. Validation: Run all E2E tests (must pass)
14. Validation: Manual accessibility test (keyboard navigation, screen reader)
15. Update: CLAUDE.md with new routes and components

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, verify all acceptance criteria)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - Design adheres to all constitutional principles without exceptions.

## Progress Tracking
*This checklist is updated during execution flow*

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
- [x] All NEEDS CLARIFICATION resolved (via /clarify session)
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
