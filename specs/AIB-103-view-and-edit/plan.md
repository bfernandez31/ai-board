# Implementation Plan: View and Edit the Constitution

**Branch**: `AIB-103-view-and-edit` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-103-view-and-edit/spec.md`

## Summary

Add a constitution viewer/editor to the project settings page, enabling users to view, edit, and review the history of `.specify/memory/constitution.md`. This feature reuses existing documentation viewer patterns (react-markdown rendering, GitHub file operations, commit history) and follows established project settings card patterns.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, react-markdown, react-syntax-highlighter, TanStack Query v5, shadcn/ui, Octokit
**Storage**: GitHub API (file content at `.specify/memory/constitution.md`), no database changes required
**Testing**: Playwright (E2E for UI flows), Vitest (unit tests for utility functions)
**Target Platform**: Web browser (Vercel-hosted Next.js application)
**Project Type**: Web application (Next.js App Router structure)
**Performance Goals**: View content <3s (SC-001), Edit cycle <2 minutes (SC-002), History load <5s for 100 commits (SC-004)
**Constraints**: Reuse existing patterns from spec/plan/tasks viewers; no new dependencies
**Scale/Scope**: Single file per project, moderate edit frequency, ~100 commits per file max

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status |
|-----------|-------------|--------|
| I. TypeScript-First | All code in strict TypeScript with explicit types | PASS |
| II. Component-Driven | Use shadcn/ui components exclusively; feature folder structure | PASS |
| III. Test-Driven | Playwright E2E tests for viewer/editor flows; search existing tests first | PASS |
| IV. Security-First | Validate inputs with Zod; use project access authorization | PASS |
| V. Database Integrity | No database changes required (GitHub file storage only) | PASS |
| V. Specification Guardrails | CONSERVATIVE policy applied per spec | PASS |

**Gate Status**: ALL PASS - proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/AIB-103-view-and-edit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.yaml         # OpenAPI specification
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── constitution/
│               ├── route.ts           # GET/PUT constitution content
│               ├── history/
│               │   └── route.ts       # GET commit history
│               └── diff/
│                   └── route.ts       # GET commit diff
└── projects/
    └── [projectId]/
        └── settings/
            └── page.tsx               # Add ConstitutionCard

components/
└── settings/
    ├── constitution-card.tsx          # Entry point card with button
    └── constitution-viewer.tsx        # Modal with view/edit/history tabs

lib/
├── github/
│   └── constitution-fetcher.ts        # Fetch constitution from GitHub
└── hooks/
    ├── use-constitution.ts            # Query hook for content
    └── use-constitution-history.ts    # Query hook for history/diff

tests/
├── e2e/
│   └── constitution.spec.ts           # Playwright E2E tests
└── unit/
    └── constitution-validation.test.ts # Vitest unit tests
```

**Structure Decision**: Next.js App Router web application structure. New files follow existing patterns from documentation viewer (`components/board/documentation-viewer.tsx`, `lib/github/doc-fetcher.ts`, `app/api/projects/[projectId]/docs/`).

## Constitution Check (Post-Design Re-evaluation)

*Re-evaluated after Phase 1 design completion.*

| Principle | Design Artifact | Compliance Verification |
|-----------|-----------------|------------------------|
| I. TypeScript-First | `data-model.md` interfaces | All types explicitly defined (ConstitutionContent, ConstitutionCommit, etc.) |
| II. Component-Driven | `plan.md` source structure | Uses shadcn/ui (Card, Dialog, Button, Textarea); feature folder at `components/settings/` |
| III. Test-Driven | `quickstart.md` test section | E2E tests in `tests/e2e/constitution.spec.ts`; unit tests in `tests/unit/` |
| IV. Security-First | `contracts/api.yaml` | Zod validation for content; `verifyProjectAccess()` authorization on all endpoints |
| V. Database Integrity | `data-model.md` | No database schema changes; GitHub API only |
| V. Specification Guardrails | `research.md` | CONSERVATIVE policy followed; no shortcuts taken |

**Post-Design Gate Status**: ALL PASS - ready for task generation

## Complexity Tracking

*No constitution violations requiring justification - implementation follows established patterns.*

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| New API routes | 3 routes for constitution CRUD | Follows existing `/docs/` route patterns |
| New components | 2 components (card + viewer) | Follows existing settings card pattern |
| Reused components | DocumentationEditor, CommitHistoryViewer, DiffViewer, react-markdown config | Maximizes code reuse |
