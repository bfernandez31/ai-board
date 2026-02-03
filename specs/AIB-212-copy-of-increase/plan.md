# Implementation Plan: Increase Ticket Description Limit to 10000 Characters

**Branch**: `AIB-212-copy-of-increase` | **Date**: 2026-02-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-212-copy-of-increase/spec.md`

## Summary

Increase ticket description character limit from 2500 to 10000 characters across all validation layers (database, server-side Zod schemas, client-side validation) and update UI character counters. This enables users to include detailed AI-generated specifications in ticket descriptions.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, Zod, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web application (Vercel hosting)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: No performance degradation; standard response times
**Constraints**: Database column size must accommodate 10000 characters
**Scale/Scope**: Single numeric constant change across 7 files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. TypeScript-First | ✅ PASS | All changes are to TypeScript files with explicit types |
| II. Component-Driven | ✅ PASS | Uses existing shadcn/ui components (CharacterCounter, Textarea) |
| III. Test-Driven | ✅ PASS | Existing tests in `tests/unit/ticket-validation.test.ts` will be updated |
| IV. Security-First | ✅ PASS | Zod validation maintained at all layers; no new attack vectors |
| V. Database Integrity | ✅ PASS | Prisma migration for schema change; no data loss (increasing limit) |
| VI. AI-First Development | ✅ PASS | No README/guide files created; changes follow existing patterns |

**Gate Status**: ✅ ALL GATES PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/AIB-212-copy-of-increase/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A for this feature - no new endpoints)
└── tasks.md             # Phase 2 output (/ai-board.tasks command)
```

### Source Code (affected files)

```
prisma/
└── schema.prisma                    # Database column VarChar(2500) → VarChar(10000)

lib/
├── validations/
│   └── ticket.ts                    # Zod schemas (3 locations: .max(2500) → .max(10000))
└── hooks/
    └── use-ticket-edit.ts           # maxLength usage (passed from caller)

components/
├── ui/
│   └── character-counter.tsx        # No changes needed (uses max prop)
└── board/
    ├── new-ticket-modal.tsx         # Update placeholder text and counter display
    └── ticket-detail-modal.tsx      # Update maxLength prop

app/api/projects/[projectId]/tickets/
├── route.ts                         # Uses Zod validation (auto-updated via schema)
└── [id]/route.ts                    # Uses Zod validation (auto-updated via schema)

tests/unit/
└── ticket-validation.test.ts        # Update test cases for 10000 limit
```

**Structure Decision**: Next.js App Router web application with feature-based component organization. This is a single constant change propagated across validation, UI, and database layers.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | No violations | Feature follows all constitution principles |

## Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `prisma/schema.prisma` | `@db.VarChar(2500)` → `@db.VarChar(10000)` | 112 |
| `lib/validations/ticket.ts` | `.max(2500)` → `.max(10000)` (3 locations) | 48, 82, 105 |
| `components/board/new-ticket-modal.tsx` | Update placeholder text and counter | 263, 274 |
| `components/board/ticket-detail-modal.tsx` | Update maxLength prop | 1096 |
| `tests/unit/ticket-validation.test.ts` | Update test cases | 144-148, 165-172 |

**Total files**: 5 (plus Prisma migration file generated)

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion*

| Principle | Status | Post-Design Evidence |
|-----------|--------|---------------------|
| I. TypeScript-First | ✅ PASS | No new types needed; existing types accommodate larger strings |
| II. Component-Driven | ✅ PASS | No new components; existing CharacterCounter accepts any max value |
| III. Test-Driven | ✅ PASS | Test plan updates existing `ticket-validation.test.ts` per constitution |
| IV. Security-First | ✅ PASS | Zod validation enforced at all layers; input sanitization unchanged |
| V. Database Integrity | ✅ PASS | Prisma migration is non-destructive; no data transformation needed |
| VI. AI-First Development | ✅ PASS | Design artifacts in spec folder; no root-level documentation created |

**Post-Design Gate Status**: ✅ ALL GATES PASS - Ready for `/ai-board.tasks`

## Next Steps

1. Run `/ai-board.tasks` to generate `tasks.md` from this plan
2. Execute implementation via `/ai-board.implement`
3. Run verification via `/ai-board.verify`
