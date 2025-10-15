# Implementation Plan: Auto-Clarification Resolution System

**Branch**: `029-999-auto-clarification` | **Date**: 2025-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-999-auto-clarification/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement auto-resolution system for specification clarifications using configurable policies (AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE). System includes database enum, API endpoints for policy management, UI components for configuration, GitHub Actions workflow integration, and enhanced /specify command with context-aware resolution logic. Primary goals: reduce spec generation time from 10-15min to 3-5min, eliminate manual clarification steps, maintain transparency via Auto-Resolved Decisions documentation.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, shadcn/ui
**Storage**: PostgreSQL 14+ (enum ClarificationPolicy, Project.clarificationPolicy NOT NULL default AUTO, Ticket.clarificationPolicy NULLABLE)
**Testing**: Playwright (E2E), unit tests for policy resolution logic, API integration tests
**Target Platform**: Vercel serverless (Next.js App Router API routes)
**Project Type**: Web (existing Next.js monorepo with backend API routes + frontend React components)
**Performance Goals**: <200ms p95 API response, 3-5min spec generation (down from 10-15min), <500ms AUTO context detection
**Constraints**: Prisma enum validation, GitHub Actions workflow compatibility, backward compatibility (INTERACTIVE mode preserved), hierarchical policy resolution (ticket > project > AUTO)
**Scale/Scope**: 4 models (ClarificationPolicy enum, Project/Ticket extensions), 4 API endpoints (GET/PATCH for projects/tickets), 4 UI components (settings card, creation modal, detail view, board badges), 1 workflow enhancement, 1 /specify command extension

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
✅ **PASS** - All code uses TypeScript 5.6 strict mode with explicit types. Zod schemas validate enum values at runtime. Prisma types auto-generated for database models.

### II. Component-Driven Architecture
✅ **PASS** - UI components follow shadcn/ui patterns (Select, Badge, Dialog, Card). Server Components by default with "use client" for interactive forms. API routes in `/app/api/projects/:id/route.ts` pattern. Feature-based folders: `/components/settings/clarification-policy-card.tsx`.

### III. Test-Driven Development
✅ **PASS** - E2E tests required before implementation (Playwright with policy workflows). Unit tests for policy resolution logic and AUTO context detection. Integration tests for API CRUD operations. Test discovery workflow: search existing tests before creating new files.

### IV. Security-First Design
✅ **PASS** - Zod validation for all policy inputs (enum + null). Prisma parameterized queries exclusively. Project ownership validation on PATCH endpoints. No sensitive data in policy values (enum strings only). Environment variables for API URLs in GitHub Actions.

### V. Database Integrity
✅ **PASS** - Prisma migration for enum and schema changes. NOT NULL constraint with default (AUTO) for Project. NULLABLE for Ticket (inheritance semantics). Foreign key constraints enforced. Transaction safety: policy updates are single-field atomic operations.

### VI. Specification Clarification Guardrails
✅ **PASS** - This feature implements the guardrails themselves. Hierarchical resolution (ticket > project > AUTO). AUTO fallback to CONSERVATIVE on low confidence. PRAGMATIC retains security/testing obligations. Auto-Resolved Decisions section documents trade-offs for review.

**VERDICT**: All gates PASS. No violations requiring justification. No complexity exceptions needed.

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
│   │   ├── [id]/
│   │   │   └── route.ts          # GET/PATCH project (clarificationPolicy)
│   │   └── [projectId]/
│   │       └── tickets/
│   │           └── [ticketId]/
│   │               └── route.ts  # GET/PATCH ticket (clarificationPolicy)
│   └── ...
├── projects/
│   ├── [id]/
│   │   ├── settings/
│   │   │   └── page.tsx          # Project settings with policy card
│   │   └── board/
│   │       └── page.tsx          # Board view with policy badges
│   └── ...
└── lib/
    ├── schemas/
    │   └── clarification-policy.ts  # Zod validation schemas
    └── utils/
        └── policy-resolution.ts     # Hierarchical resolution logic

components/
├── settings/
│   └── clarification-policy-card.tsx  # Project settings UI
├── tickets/
│   ├── create-ticket-modal.tsx        # Enhanced with policy field
│   ├── ticket-detail-view.tsx         # Enhanced with policy badge
│   └── policy-edit-dialog.tsx         # Policy override dialog
└── board/
    └── ticket-card.tsx                # Enhanced with policy badge

prisma/
├── schema.prisma                      # Enum + model changes
└── migrations/
    └── [timestamp]_add_clarification_policy/
        └── migration.sql

.github/
└── workflows/
    └── ticket-workflow.yml            # Enhanced with policy fetch step

.claude/
└── commands/
    └── specify.md                     # Enhanced with policy logic

tests/
├── e2e/
│   ├── clarification-policy.spec.ts   # Policy workflows E2E
│   └── auto-resolution.spec.ts        # AUTO context detection E2E
├── api/
│   └── clarification-policy-api.spec.ts  # API CRUD integration
└── unit/
    ├── policy-resolution.test.ts      # Hierarchical logic unit
    └── auto-context-detection.test.ts # AUTO keyword matching unit
```

**Structure Decision**: Web application (Next.js monorepo). Database layer: Prisma enum + migrations. API layer: Next.js App Router routes with Zod validation. Frontend: React Server Components + Client Components for forms. Testing: Playwright E2E + unit tests for business logic.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected.** All gates passed without requiring complexity justifications.

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 (data model + contracts) completion*

### I. TypeScript-First Development
✅ **PASS** - API contracts define explicit TypeScript types (OpenAPI 3.0). Zod schemas use `z.nativeEnum()` for type safety. Prisma auto-generates TypeScript enums. All function signatures typed explicitly.

### II. Component-Driven Architecture
✅ **PASS** - UI components use shadcn/ui primitives (Select, Badge, Dialog, Card, Tooltip). Feature-based folders: `/components/settings/clarification-policy-card.tsx`. API routes follow `/app/api/projects/:id/route.ts` pattern. Utility functions in `/lib/utils/`.

### III. Test-Driven Development
✅ **PASS** - Quickstart guide defines tests before implementation (Phase 2 before Phase 3-5). Unit tests for policy resolution logic. Integration tests for API CRUD. E2E tests for complete workflows. Test discovery workflow documented.

### IV. Security-First Design
✅ **PASS** - Zod validation on all API endpoints (enum values). Prisma parameterized queries (no raw SQL). Project ownership validation enforced. No sensitive data in policy values (enum strings only). Session authentication required.

### V. Database Integrity
✅ **PASS** - Prisma migration defined with rollback script. NOT NULL constraint with default (AUTO) for Project. NULLABLE for Ticket (inheritance semantics). Foreign key constraints enforced. Migration tested for idempotency and rollback safety.

### VI. Specification Clarification Guardrails
✅ **PASS** - Implementation follows guardrails: hierarchical resolution (ticket > project > AUTO), AUTO fallback to CONSERVATIVE on low confidence, PRAGMATIC retains security/testing obligations, Auto-Resolved Decisions section documents trade-offs.

**VERDICT**: All gates PASS post-design. No new violations introduced. Design adheres to all constitution principles.
