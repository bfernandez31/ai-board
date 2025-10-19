# Implementation Plan: Documentation Edit Mode

**Branch**: `036-mode-to-update` | **Date**: 2025-10-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/036-mode-to-update/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable inline editing of documentation files (spec.md, plan.md, tasks.md) within the ticket modal with stage-based permissions. Users can edit spec.md when in SPECIFY stage and plan.md/tasks.md when in PLAN stage. Changes are committed and pushed to the feature branch via API endpoints that interact with the GitHub repository.

**Technical Approach**: Extend existing documentation viewer (feature 035) with edit mode toggle, textarea-based markdown editor, and new API endpoints for git operations (commit, push). Use React state management for edit session, TanStack Query for mutations with optimistic updates, and server-side git operations via Node.js child_process or simple-git library.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, TanStack Query v5, shadcn/ui, @octokit/rest (GitHub API for commits)
**Storage**: PostgreSQL 14+ via Prisma (ticket metadata), GitHub repository (documentation files via API)
**Testing**: Playwright (E2E tests for edit workflow and GitHub API operations)
**Target Platform**: Web application (Next.js on Vercel)
**Project Type**: Web (frontend + backend)
**Performance Goals**: <2 seconds for save operations (GitHub API commit), <100ms for edit mode toggle
**Constraints**: Must handle concurrent edits gracefully (GitHub API handles conflicts), network failures must return clear error messages
**Scale/Scope**: Small feature (~3-5 components, 1 API route, 15-20 E2E test scenarios)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- All code will be TypeScript 5.6 with strict mode
- API request/response types defined with Zod schemas
- Git operation responses properly typed

### II. Component-Driven Architecture ✅
- Edit mode components extend existing DocumentationViewer from feature 035
- shadcn/ui components for buttons, textarea, dialogs (confirmation prompts)
- Server Components by default, Client Components for edit state management

### III. Test-Driven Development ✅
- E2E tests written BEFORE implementation
- Search existing tests in `tests/e2e/documentation-viewer.spec.ts` before creating new files
- Test scenarios: edit mode toggle, save success, cancel, permission checks, error handling

### IV. Security-First Design ✅
- Validate all inputs (file content, commit messages) with Zod
- Verify user owns the project before allowing git operations
- Validate branch existence before committing
- No sensitive data (git credentials) exposed in API responses

### V. Database Integrity ✅
- No database schema changes required (feature uses existing Ticket.branch field)
- Git operations are file-system based, not database transactions

### VI. State Management ✅
- TanStack Query mutations for save operations with optimistic updates
- Local React state for edit mode toggle and content changes
- No additional state libraries needed

**Status**: All constitution principles satisfied. No violations requiring justification.

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
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── docs/
│               └── route.ts              # New: POST /api/projects/:id/docs (commit & push)
├── lib/
│   ├── hooks/
│   │   └── mutations/
│   │       └── useEditDocumentation.ts   # New: TanStack Query mutation for save
│   ├── git/
│   │   └── operations.ts                 # New: Git commit/push helpers
│   └── schemas/
│       └── documentation.ts              # New: Zod schemas for doc edit requests
│
components/
└── ticket/
    ├── documentation-viewer.tsx          # Existing: from feature 035
    ├── documentation-editor.tsx          # New: Edit mode component
    └── edit-permission-guard.tsx         # New: Stage-based permission logic

tests/
└── e2e/
    └── documentation-editor.spec.ts      # New: E2E tests for edit workflow
```

**Structure Decision**: Web application using Next.js App Router conventions. API routes follow RESTful patterns. Components organized by feature (ticket). Git operations isolated in lib/git for testability. TanStack Query mutations in lib/hooks/mutations following existing patterns from features 028 and 034.

## Complexity Tracking

*No constitution violations - section not applicable.*
