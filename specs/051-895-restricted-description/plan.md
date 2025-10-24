# Implementation Plan: Restricted Ticket Editing by Stage

**Branch**: `051-895-restricted-description` | **Date**: 2025-10-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/051-895-restricted-description/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement stage-based editing restrictions for ticket description and clarification policy fields. Users can freely edit these fields only when tickets are in INBOX stage. Once tickets move to SPECIFY, PLAN, BUILD, VERIFY, or SHIP stages, description becomes read-only and the edit policy button is hidden. This ensures specification stability during active development while allowing refinement before work begins.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, TanStack Query v5.90.5, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit tests for utilities), Playwright (integration and E2E tests)
**Target Platform**: Vercel (Next.js optimized serverless)
**Project Type**: Web application (frontend + backend in Next.js App Router)
**Performance Goals**: <100ms p95 API response time, client-side rendering optimized with Server Components
**Constraints**: Vercel serverless function limits (10s timeout), client-side state must reflect stage changes via polling (2s interval)
**Scale/Scope**: Multi-user project collaboration, ~50-100 concurrent users per project, real-time updates via client-side polling

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development
- ✅ **PASS**: All code will be written in TypeScript strict mode with explicit type annotations
- ✅ **PASS**: API validation will use Zod schemas for stage-based edit restrictions
- ✅ **PASS**: No `any` types required for this feature

### Principle II: Component-Driven Architecture
- ✅ **PASS**: Uses shadcn/ui components for read-only display and form controls
- ✅ **PASS**: Server Components by default, Client Components only for interactive edit controls
- ✅ **PASS**: API routes follow Next.js App Router conventions (`PATCH /api/projects/[projectId]/tickets/[id]`)
- ✅ **PASS**: Conditional rendering logic based on ticket stage (standard React pattern)

### Principle III: Test-Driven Development
- ✅ **PASS**: Vitest unit tests for stage validation utility functions
- ✅ **PASS**: Playwright integration tests for ticket editing UI with stage restrictions
- ✅ **PASS**: Playwright E2E tests for critical user flows (INBOX edit → stage transition → read-only verification)
- ⚠️ **ACTION REQUIRED**: Must search for existing ticket editing tests before creating new test files

### Principle IV: Security-First Design
- ✅ **PASS**: Server-side validation prevents description/policy updates in non-INBOX stages
- ✅ **PASS**: Zod schemas validate stage before accepting mutations
- ✅ **PASS**: No new secrets or sensitive data exposure
- ✅ **PASS**: Authentication middleware already enforced on ticket API routes

### Principle V: Database Integrity
- ✅ **PASS**: No schema changes required (uses existing stage, description, clarificationPolicy fields)
- ✅ **PASS**: Stage field already enforced at schema level (enum constraint)
- ✅ **PASS**: No transactions required (single-record updates)

### Principle VI: Specification Clarification Guardrails
- ✅ **PASS**: Spec used INTERACTIVE policy with documented auto-resolved decisions
- ✅ **PASS**: Trade-offs clearly documented in spec.md
- ✅ **PASS**: No violations of security, data integrity, or testing requirements

**GATE STATUS**: ✅ ALL GATES PASSED - Proceed to Phase 0 research

## Project Structure

### Documentation (this feature)

```
specs/051-895-restricted-description/
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
│           └── tickets/
│               └── [id]/
│                   └── route.ts        # PATCH endpoint with stage validation
├── lib/
│   ├── schemas/
│   │   └── ticket-validation.ts       # Zod schemas for stage-based validation
│   ├── hooks/
│   │   └── mutations/
│   │       └── useUpdateTicket.ts     # TanStack Query mutation
│   └── utils/
│       └── stage-validation.ts        # Stage-based edit permission utilities
└── components/
    └── tickets/
        ├── ticket-description-field.tsx   # Conditional read-only/editable display
        └── edit-policy-button.tsx         # Conditional visibility based on stage

tests/
├── unit/
│   └── stage-validation.test.ts       # Vitest unit tests for utility functions
├── integration/
│   └── ticket-editing.spec.ts         # Playwright integration tests for UI
└── e2e/
    └── stage-based-restrictions.spec.ts   # Playwright E2E tests for full workflow

prisma/
└── schema.prisma                      # No changes required (existing fields)
```

**Structure Decision**: Web application using Next.js App Router with co-located frontend and API routes. Feature uses existing database schema (stage, description, clarificationPolicy fields). Validation logic lives in `/app/lib/` for reusability across API routes and client-side hooks.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations detected. All constitution principles are fully satisfied by this feature implementation.

## Post-Design Constitution Re-Check

*Re-evaluation after Phase 1 design artifacts (research.md, data-model.md, contracts/api.md, quickstart.md)*

### Principle I: TypeScript-First Development
- ✅ **PASS**: All planned code uses TypeScript strict mode
- ✅ **PASS**: Utility function `canEditDescriptionAndPolicy(stage: Stage): boolean` has explicit types
- ✅ **PASS**: API contract specifies Zod validation schemas with type inference
- ✅ **PASS**: No `any` types in planned implementation

### Principle II: Component-Driven Architecture
- ✅ **PASS**: Conditional rendering pattern follows React best practices
- ✅ **PASS**: Uses existing shadcn/ui components (Textarea, Button, Dialog)
- ✅ **PASS**: Server-side validation in API route, client-side conditional UI
- ✅ **PASS**: Feature-based folder structure maintained

### Principle III: Test-Driven Development
- ✅ **PASS**: Vitest unit tests planned for pure validation function (`/tests/unit/stage-validation.test.ts`)
- ✅ **PASS**: Playwright integration tests planned for UI behavior (`/tests/integration/ticket-editing.spec.ts`)
- ✅ **PASS**: Playwright E2E tests planned for full workflow (`/tests/e2e/stage-based-restrictions.spec.ts`)
- ✅ **PASS**: Quickstart.md includes test discovery workflow (grep/glob before creating new tests)
- ✅ **PASS**: Red-Green-Refactor cycle documented in quickstart

### Principle IV: Security-First Design
- ✅ **PASS**: Server-side validation enforces business rule before database update
- ✅ **PASS**: Stage validation occurs after authentication/authorization checks
- ✅ **PASS**: Client-side UI restrictions provide UX, not security (server is source of truth)
- ✅ **PASS**: Error code `INVALID_STAGE_FOR_EDIT` provides clear feedback without exposing internals

### Principle V: Database Integrity
- ✅ **PASS**: No schema changes required (data-model.md confirms)
- ✅ **PASS**: Existing optimistic concurrency control (version field) preserved
- ✅ **PASS**: Stage enum constraint enforced at schema level (no application-level enum validation needed)
- ✅ **PASS**: Atomic updates with version increment

### Principle VI: Specification Clarification Guardrails
- ✅ **PASS**: Design artifacts (research, data-model, contracts, quickstart) provide comprehensive implementation guidance
- ✅ **PASS**: All NEEDS CLARIFICATION items resolved in research.md
- ✅ **PASS**: Auto-resolved decisions from spec.md preserved and expanded in design docs
- ✅ **PASS**: Security controls maintained (server-side validation mandatory)

**FINAL GATE STATUS**: ✅ ALL GATES PASSED - Ready for Phase 2 (task generation via /speckit.tasks)

### Design Quality Assessment

**Strengths**:
- Zero database migrations required (low risk, fast implementation)
- Extends existing patterns (API validation, TanStack Query mutations, conditional rendering)
- Comprehensive error handling (400, 409, 401, 403, 404 errors)
- Clear separation of concerns (server validation + client UI)
- Performance impact negligible (<5ms additional latency)

**Risks Mitigated**:
- Concurrent edit conflicts: Handled by existing version control + stage validation order
- Stage rollback edge case: Documented in research.md and quickstart.md
- Client bypass: Server-side validation mandatory (Principle IV)
- Test duplication: Test discovery workflow in quickstart prevents duplicate files

**Implementation Complexity**: Low
- No new dependencies
- No breaking changes
- Estimated timeline: 2 hours (per quickstart.md)
- Test coverage: Unit + Integration + E2E (hybrid strategy per constitution)
