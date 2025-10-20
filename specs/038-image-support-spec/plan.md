# Implementation Plan: Image Attachments for Tickets

**Branch**: `038-image-support-spec` | **Date**: 2025-10-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/038-image-support-spec/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable users to attach images (mockups, diagrams, screenshots) to tickets during creation, which are stored in GitHub and passed to Claude during specification generation for enhanced visual context. Images are uploaded via drag-and-drop, file picker, or clipboard paste, validated for format and size, and moved from `ticket-assets/` on main branch to feature branch assets during the specify workflow.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, @octokit/rest 22.0, shadcn/ui
**Storage**: PostgreSQL 14+ (Ticket.attachments JSON field), GitHub repository (image files)
**Testing**: Playwright (E2E tests), existing test patterns in `/tests/`
**Target Platform**: Web application (Vercel deployment)
**Project Type**: Web (Next.js App Router with API routes)
**Performance Goals**: <10s image upload time (95th percentile), <200ms API response for ticket creation
**Constraints**: 10MB max file size per image, 5 images max per ticket, GitHub API rate limits (5000/hour authenticated)
**Scale/Scope**: Expected 100s of tickets with images per day, GitHub repo size monitoring required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅

- **Status**: COMPLIANT
- **Evidence**: All code will use TypeScript 5.6 strict mode with explicit types
- **Implementation**: Prisma JSON field type for attachments, Zod schemas for validation, typed interfaces for TicketAttachment

### II. Component-Driven Architecture ✅

- **Status**: COMPLIANT
- **Evidence**: UI uses shadcn/ui components (file upload, dialogs), feature-based folder structure
- **Implementation**:
  - `components/board/new-ticket-modal.tsx` (extend existing)
  - `components/ui/image-upload.tsx` (new reusable component based on shadcn/ui primitives)
  - `lib/validations/ticket.ts` (extend existing with attachment validation)

### III. Test-Driven Development ✅

- **Status**: COMPLIANT
- **Evidence**: Playwright E2E tests required before implementation per constitution
- **Implementation**:
  - Search for existing ticket creation tests in `/tests/` before creating new files
  - Extend existing test suites (e.g., `/tests/api/tickets.spec.ts`, `/tests/e2e/ticket-creation.spec.ts`)
  - Write tests for image upload, validation, and GitHub storage flows first (Red)
  - Implement feature to pass tests (Green)
  - No feature complete without passing E2E tests

### IV. Security-First Design ✅

- **Status**: COMPLIANT
- **Evidence**: Zod validation for file size/type, no raw SQL, GitHub API requires auth
- **Implementation**:
  - Validate MIME types and file signatures (not just extensions)
  - Use Zod schema for attachment metadata validation
  - Parameterized Prisma queries for ticket updates
  - Environment variable for GitHub token (no secrets in code)
  - NextAuth session validation for image upload endpoints

### V. Database Integrity ✅

- **Status**: COMPLIANT
- **Evidence**: Prisma migration for Ticket.attachments field, JSON validation
- **Implementation**:
  - Prisma migration: add `attachments Json?` field to Ticket model
  - Default value: empty JSON array `[]`
  - Transaction for ticket creation + GitHub commit (rollback on failure)
  - Soft delete consideration: images remain in feature branch even if ticket deleted (audit trail)

### VI. Specification Clarification Guardrails ✅

- **Status**: COMPLIANT
- **Evidence**: Spec includes Auto-Resolved Decisions section with AUTO policy, confidence scores, and trade-offs
- **Implementation**: 4 decisions documented with confidence 0.7-0.9, 1 CONSERVATIVE fallback for file limits

**GATE RESULT**: ✅ **PASSED** - All constitution principles compliant, no violations requiring justification

---

**POST-DESIGN RE-EVALUATION** (after Phase 1 completion):

All constitution principles remain compliant after detailed design:

- ✅ **TypeScript-First**: All interfaces defined (TicketAttachment, Zod schemas), strict mode enforced
- ✅ **Component-Driven**: Uses shadcn/ui for image upload component, follows feature-based structure
- ✅ **TDD**: E2E tests planned before implementation (search for existing tests first per constitution)
- ✅ **Security-First**: Multi-layer validation (MIME + magic bytes), Zod schemas, parameterized queries
- ✅ **Database Integrity**: Prisma migration created, transaction pattern for atomicity
- ✅ **Clarification Guardrails**: Auto-resolved decisions documented with confidence scores

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
│   ├── projects/
│   │   └── [projectId]/
│   │       └── tickets/
│   │           └── route.ts           # MODIFY: accept multipart/form-data, commit images to GitHub
│   └── uploads/
│       └── image/
│           └── route.ts               # NEW: individual image upload endpoint
├── lib/
│   ├── schemas/
│   │   └── ticket.ts                  # MODIFY: add TicketAttachment schema, attachment validation
│   ├── github/
│   │   ├── client.ts                  # EXISTING: Octokit instance
│   │   └── operations.ts              # NEW: commitImageToRepo, moveImagesToFeatureBranch, deleteTicketAssets
│   └── validations/
│       └── image.ts                   # NEW: validateImageFile (MIME, size, signature)
└── components/
    ├── board/
    │   └── new-ticket-modal.tsx       # MODIFY: add image upload UI, handle attachments
    └── ui/
        └── image-upload.tsx           # NEW: reusable image upload component (drag-drop, paste, preview)

prisma/
├── schema.prisma                      # MODIFY: add Ticket.attachments field (Json?)
└── migrations/
    └── [timestamp]_add_ticket_attachments/
        └── migration.sql              # NEW: ALTER TABLE Ticket ADD COLUMN attachments JSONB

.github/
└── workflows/
    └── speckit.yml                    # MODIFY: add image handling steps (download external URLs, move to feature branch)

.claude/
└── commands/
    └── specify.md                     # MODIFY: accept imageContext parameter, handle image paths

tests/
├── api/
│   ├── tickets.spec.ts                # MODIFY: extend with image upload tests
│   └── image-upload.spec.ts           # NEW: test individual image upload endpoint
└── e2e/
    ├── ticket-creation.spec.ts        # MODIFY: add image attachment E2E tests
    └── clipboard-paste.spec.ts        # NEW: test clipboard paste functionality
```

**Structure Decision**: Web application using Next.js App Router conventions. Backend logic in `/app/api/`, frontend components in `/components/`, shared utilities in `/lib/`. Tests follow existing patterns in `/tests/api/` and `/tests/e2e/`. Database schema managed via Prisma migrations. GitHub workflow modifications in `.github/workflows/`.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - All constitution principles are satisfied without exceptions.
