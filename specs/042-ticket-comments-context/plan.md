# Implementation Plan: Ticket Comments with Tabs Layout

**Branch**: `042-ticket-comments-context` | **Date**: 2025-01-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/042-ticket-comments-context/spec.md`

## Summary

Add a comment system to tickets with markdown support, real-time updates via polling, and reorganize the ticket detail modal using a modern tabs layout (Details, Comments, Files). Users can create, view, and delete comments with optimistic updates and project-level authorization. The implementation follows existing patterns (job polling, TanStack Query state management, shadcn/ui components) and prioritizes security through input validation, authorization checks, and XSS prevention.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, TanStack Query v5.90.5, shadcn/ui, react-markdown 9.0.1, date-fns
**Storage**: PostgreSQL 14+ (Comment table with foreign keys to Ticket and User, cascade delete)
**Testing**: Playwright (E2E tests), contract tests for API endpoints
**Target Platform**: Web application (Next.js on Vercel)
**Project Type**: Web (frontend + backend)
**Performance Goals**:
- Comment submission < 2 seconds
- Tab navigation < 1 second (instant UI)
- Poll interval: 10 seconds
- 100 comments render < 500ms
**Constraints**:
- Authorization: Project ownership validation (only owners can view/create/delete comments)
- Security: XSS prevention via react-markdown HTML escaping, Zod validation on server
- Real-time: Polling (not WebSocket) to align with existing job polling pattern
- Mobile responsive: Full-screen modal on mobile, max-w-2xl on desktop
**Scale/Scope**:
- 3 new API endpoints (GET, POST, DELETE comments)
- 1 new database table (Comment model with 2 indexes)
- 6 React components (Tabs, CommentList, CommentForm, CommentItem, Avatar, CharacterCounter)
- 39 functional requirements, 15 success criteria, 6 user stories
- E2E test coverage target: ≥90%

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- **Status**: PASS
- **Evidence**: TypeScript 5.6 strict mode enabled, all API responses and database models will have TypeScript interfaces, no `any` types planned

### II. Component-Driven Architecture ✅
- **Status**: PASS
- **Evidence**: Using shadcn/ui Tabs component, feature-based folder structure (`/components/comments/`), API routes in `/app/api/projects/[projectId]/tickets/[ticketId]/comments/`, Server Components by default with Client Components for interactivity

### III. Test-Driven Development (NON-NEGOTIABLE) ✅
- **Status**: PASS
- **Evidence**: Playwright E2E tests required before implementation per spec (FR-035 to FR-039 security requirements, SC-009 requires ≥90% coverage), test discovery workflow will be followed to search for existing tests before creating new files

### IV. Security-First Design ✅
- **Status**: PASS
- **Evidence**:
  - Zod validation for all comment inputs (1-2000 character limit)
  - Prisma parameterized queries for all database operations
  - Project ownership validation on all API endpoints (403 Forbidden for unauthorized access)
  - Comment authorship validation for deletion (only authors can delete their own comments)
  - XSS prevention via react-markdown HTML escaping (FR-038)
  - No sensitive data exposed in API responses

### V. Database Integrity ✅
- **Status**: PASS
- **Evidence**:
  - All schema changes via Prisma migrations
  - Cascade delete on foreign keys (Comment.ticketId → Ticket, Comment.userId → User)
  - No optional fields without defaults (createdAt, updatedAt have defaults)
  - Indexes on (ticketId, createdAt) and (userId) for query performance
  - TanStack Query transactions for optimistic updates with rollback

### V. Specification Clarification Guardrails ✅
- **Status**: PASS
- **Evidence**: AUTO policy applied → CONSERVATIVE (Medium confidence 0.6), 5 auto-resolved decisions documented with trade-offs and reviewer notes, PRAGMATIC elements excluded (no shortcuts that compromise security/testing)

**Gate Result**: ✅ **PASS** - All constitution principles satisfied, no violations requiring justification

**Post-Design Re-Check**: ✅ **PASS** - Phase 1 design artifacts (data-model.md, API contracts, quickstart.md) reviewed and validated against constitution. All design decisions remain compliant with TypeScript-First Development, Component-Driven Architecture, TDD, Security-First Design, Database Integrity, and Specification Clarification Guardrails.

## Project Structure

### Documentation (this feature)

```
specs/042-ticket-comments-context/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (to be generated)
├── data-model.md        # Phase 1 output (to be generated)
├── quickstart.md        # Phase 1 output (to be generated)
├── contracts/           # Phase 1 output (to be generated)
│   ├── get-comments.yaml
│   ├── post-comment.yaml
│   └── delete-comment.yaml
├── checklists/
│   └── requirements.md  # Spec quality checklist (complete)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web application structure
backend/
# No changes needed - backend logic in Next.js API routes

frontend/
# No changes needed - frontend components in Next.js app directory

app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── tickets/
│               └── [ticketId]/
│                   └── comments/
│                       ├── route.ts                    # NEW: GET (list), POST (create)
│                       └── [commentId]/
│                           └── route.ts                # NEW: DELETE
├── lib/
│   ├── hooks/
│   │   ├── mutations/
│   │   │   ├── use-create-comment.ts                  # NEW: TanStack Query mutation
│   │   │   └── use-delete-comment.ts                  # NEW: TanStack Query mutation
│   │   ├── queries/
│   │   │   └── use-comments.ts                        # NEW: TanStack Query with polling
│   │   └── use-comment-polling.ts                     # NEW: Polling hook (similar to useJobPolling)
│   ├── schemas/
│   │   └── comment-validation.ts                      # NEW: Zod schemas for API validation
│   ├── types/
│   │   └── comment.ts                                 # NEW: TypeScript interfaces
│   └── query-keys.ts                                  # UPDATE: Add comment query keys
└── components/
    ├── board/
    │   └── ticket-detail-modal.tsx                    # UPDATE: Refactor to use tabs layout
    ├── comments/
    │   ├── comment-list.tsx                           # NEW: List of comments with scroll
    │   ├── comment-item.tsx                           # NEW: Single comment display with delete
    │   ├── comment-form.tsx                           # NEW: Textarea + character counter + submit
    │   └── avatar.tsx                                 # NEW: User avatar with initials fallback
    └── ui/
        ├── tabs.tsx                                   # EXISTING: shadcn/ui Tabs component
        └── character-counter.tsx                      # EXISTING: Character counter component

prisma/
├── schema.prisma                                      # UPDATE: Add Comment model
└── migrations/
    └── [timestamp]_add_comment_model/
        └── migration.sql                              # NEW: Migration for Comment table

tests/
├── api/
│   └── comments/
│       ├── create-comment.spec.ts                     # NEW: POST /comments contract tests
│       ├── list-comments.spec.ts                      # NEW: GET /comments contract tests
│       └── delete-comment.spec.ts                     # NEW: DELETE /comments/:id contract tests
└── e2e/
    └── ticket-comments.spec.ts                        # NEW: E2E tests for comment system + tabs
```

**Structure Decision**: Web application structure selected (Next.js App Router with API routes). Comments feature uses feature-based folder structure (`/components/comments/`) with API routes following REST conventions (`/api/projects/:projectId/tickets/:ticketId/comments`). TanStack Query hooks in `/lib/hooks/` for state management. Existing patterns (ImageGallery, job polling, optimistic updates) will be replicated for comments.

## Complexity Tracking

*No violations - all constitution checks pass. This section intentionally left empty.*
