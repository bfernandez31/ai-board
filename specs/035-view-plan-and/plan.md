# Implementation Plan: View Plan and Tasks Documentation

**Branch**: `035-view-plan-and` | **Date**: 2025-10-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/035-view-plan-and/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add "View Plan" and "View Tasks" buttons to ticket detail modal for full-workflow tickets. Buttons appear adjacent to existing "View Spec" button when PLAN job is completed. Files are fetched from feature branch for active tickets, and from main branch for shipped tickets (SHIP stage). The same branch selection logic applies to the existing spec button.

**Technical Approach**: Reuse existing GitHub API integration (`spec-fetcher.ts`) and SpecViewer component patterns. Create generic DocumentationViewer component that accepts document type (spec/plan/tasks) as prop. Implement conditional rendering logic based on ticket.workflowType and job status. Update spec endpoint to support branch selection based on ticket stage.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, @octokit/rest 22.0, shadcn/ui, react-markdown 9.0.1
**Storage**: PostgreSQL 14+ (Ticket, Job, Project tables)
**Testing**: Playwright (E2E tests), TEST_MODE environment variable for mocking
**Target Platform**: Web application (Vercel deployment)
**Project Type**: Web (Next.js full-stack with App Router)
**Performance Goals**: <3 seconds file load time, <100ms button visibility decision
**Constraints**: GitHub API rate limits (5000 req/hour authenticated), file size <1MB reasonable limit
**Scale/Scope**: 3 documentation types (spec, plan, tasks), 2 button visibility conditions, 2 branch selection modes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development ✅
- All code will use TypeScript strict mode with explicit type annotations
- API responses will have corresponding TypeScript interfaces
- No `any` types (justified exceptions only)

### Principle II: Component-Driven Architecture ✅
- Reuse shadcn/ui components exclusively (Button, Dialog, ScrollArea)
- Create DocumentationViewer component following existing SpecViewer patterns
- Server Components by default, Client Component for modal interactivity
- API routes follow `/app/api/projects/[projectId]/tickets/[id]/[docType]/route.ts` pattern

### Principle III: Test-Driven Development ✅
- **Test Discovery**: Search for existing tests in `tests/e2e/` for ticket-detail-modal and spec-viewer
- E2E tests required before implementation using Playwright
- Test visibility conditions (workflowType, job status, stage)
- Test branch selection logic (active vs. shipped tickets)
- Test error states (file not found, GitHub API failures)

**Test Search Commands**:
```bash
npx grep -r "describe.*ticket.*detail" tests/
npx grep -r "describe.*spec.*view" tests/
npx glob "tests/**/*spec-viewer*.spec.ts"
npx glob "tests/**/*ticket-detail*.spec.ts"
```

### Principle IV: Security-First Design ✅
- Validate all inputs (projectId, ticketId, docType) using Zod schemas
- Use Prisma parameterized queries exclusively
- Never expose GitHub tokens in responses
- Project-scoped authorization (verify ticket belongs to project)
- User authentication via NextAuth.js session (when implemented)

### Principle V: Database Integrity ✅
- No schema changes required (uses existing Ticket, Job, Project tables)
- Transactions not required (read-only operations)
- Query optimization: Include job filtering in ticket query

### Principle VI: State Management ✅
- TanStack Query v5 for server state (documentation file fetching)
- Optimistic updates not required (read-only display)
- Local state (`useState`) for modal open/close, loading, error states
- Shared state via props from parent TicketDetailModal component

**Constitution Compliance**: All principles satisfied with no violations requiring justification.

**Re-check After Phase 1**: ✅ Passed (no new violations introduced in design phase)

## Project Structure

### Documentation (this feature)

```
specs/035-view-plan-and/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── api.ts          # API request/response types
│   └── components.ts   # Component prop interfaces
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── tickets/
│               └── [id]/
│                   ├── spec/
│                   │   └── route.ts       # Existing (UPDATE: add branch logic)
│                   ├── plan/
│                   │   └── route.ts       # NEW: GET plan.md
│                   └── tasks/
│                       └── route.ts       # NEW: GET tasks.md

components/
├── board/
│   ├── ticket-detail-modal.tsx           # EXISTING (UPDATE: add plan/tasks buttons)
│   ├── spec-viewer.tsx                   # EXISTING (REFERENCE: copy patterns)
│   └── documentation-viewer.tsx          # NEW: Generic doc viewer component
└── ui/                                    # shadcn/ui components (no changes)

lib/
├── github/
│   ├── spec-fetcher.ts                   # EXISTING (UPDATE: add doc type param)
│   └── doc-fetcher.ts                    # NEW: Generic documentation fetcher
├── hooks/
│   └── use-documentation.ts              # NEW: TanStack Query hook for docs
└── validations/
    └── documentation.ts                   # NEW: Zod schemas for doc types

tests/
├── e2e/
│   ├── ticket-detail-modal.spec.ts       # EXISTING (UPDATE: add plan/tasks tests)
│   └── documentation-viewer.spec.ts      # NEW: Test doc viewer component
└── api/
    ├── plan-endpoint.spec.ts             # NEW: Contract tests for plan API
    └── tasks-endpoint.spec.ts            # NEW: Contract tests for tasks API
```

**Structure Decision**: Web application structure with Next.js App Router conventions. Feature uses existing `/app/api/projects/[projectId]/tickets/[id]/*` pattern for new plan and tasks endpoints. Reuses existing GitHub integration layer (`lib/github/`) with enhancement for generic document fetching. Components follow shadcn/ui patterns with new DocumentationViewer component mirroring SpecViewer implementation.

## Complexity Tracking

*No violations - Constitution Check passed without exceptions*

This feature maintains existing architectural patterns and requires no complexity justifications.
