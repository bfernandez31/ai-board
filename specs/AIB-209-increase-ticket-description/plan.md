# Implementation Plan: Increase Ticket Description Limit to 10000 Characters

**Branch**: `AIB-209-increase-ticket-description` | **Date**: 2026-02-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-209-increase-ticket-description/spec.md`

## Summary

Increase the ticket description character limit from 2500 to 10000 characters to support detailed AI-generated specifications. This involves a database migration to widen the VARCHAR column, updating Zod validation schemas, and modifying UI components to reflect the new limit in character counters and placeholder text.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16, React 18, Prisma 6.x, Zod 4.x, shadcn/ui, TailwindCSS 3.4
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web application (Linux server, modern browsers)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Normal response times (<200ms API, 60fps UI) - no degradation from larger text
**Constraints**: VARCHAR expansion in PostgreSQL is instant (no table rewrite needed)
**Scale/Scope**: Internal tooling, moderate usage, <50 concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gates (All PASS)

| Gate | Status | Verification |
|------|--------|--------------|
| TypeScript strict mode | PASS | `tsconfig.json` has `strict: true` |
| No `any` types | PASS | Feature involves only schema changes and constant updates |
| Zod validation | PASS | Existing `lib/validations/ticket.ts` uses Zod - will update constants |
| Prisma migrations | PASS | Will use `prisma migrate dev` for schema change |
| shadcn/ui components | PASS | Using existing CharacterCounter, Textarea components |
| Testing Trophy | PASS | Will update existing tests in `tests/unit/ticket-validation.test.ts` |
| No raw SQL | PASS | VARCHAR expansion via Prisma migration only |

### Constitution Principles Applicable

1. **TypeScript-First Development**: All validation schemas explicitly typed via Zod
2. **Database Integrity**: Schema change via Prisma migration
3. **Security-First Design**: Input validation on client and server (Zod schemas)
4. **Test-Driven Development**: Update existing validation tests
5. **AI-First Development**: No tutorial/documentation files created

## Project Structure

### Documentation (this feature)

```
specs/AIB-209-increase-ticket-description/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by plan)
```

### Source Code (repository root)

```
# Next.js App Router web application structure (existing)
prisma/
├── schema.prisma        # Ticket.description VARCHAR(2500) → VARCHAR(10000)
└── migrations/          # New migration for column expansion

lib/
└── validations/
    └── ticket.ts        # Zod schemas with 2500 → 10000 limits

components/
└── board/
    ├── new-ticket-modal.tsx      # Placeholder text update
    └── ticket-detail-modal.tsx   # Placeholder text update (if applicable)

tests/
├── unit/
│   └── ticket-validation.test.ts  # Update expected limits
└── integration/
    └── tickets/
        └── crud.test.ts           # Verify large description handling
```

**Structure Decision**: Web application with Next.js App Router. Changes span database layer (Prisma), validation layer (Zod), and UI layer (React components). Testing uses existing test files per Testing Trophy strategy.

## Complexity Tracking

*No constitution violations - simple constant/column size change.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | No violations - straightforward limit increase |

## Post-Design Constitution Re-evaluation

*Verified after Phase 1 design completion.*

### Design Compliance (All PASS)

| Principle | Status | Evidence |
|-----------|--------|----------|
| TypeScript-First | PASS | No new code patterns, only constant updates to existing typed schemas |
| Component-Driven | PASS | Reusing existing CharacterCounter and Textarea components |
| Test-Driven | PASS | Updating existing tests, no new test files per Testing Trophy |
| Security-First | PASS | Validation maintained on both client (Zod) and server (Zod + Prisma) |
| Database Integrity | PASS | Single Prisma migration, no raw SQL |
| AI-First | PASS | No README/tutorial files created, only spec artifacts |

### Risk Assessment

- **Breaking Changes**: None - backward compatible limit increase
- **Data Migration**: None - existing data preserved
- **Performance Impact**: None - VARCHAR expansion is metadata-only in PostgreSQL
- **Rollback Complexity**: Low - single migration to revert

### Implementation Confidence: HIGH

This is a straightforward configuration change across well-defined layers with existing patterns to follow.
