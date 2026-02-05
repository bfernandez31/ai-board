# Implementation Plan: Full Clone Option for Ticket Duplication

**Branch**: `AIB-219-full-clone-option` | **Date**: 2026-02-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-219-full-clone-option/spec.md`

## Summary

Transform the Duplicate button into a dropdown menu offering "Simple copy" (current behavior) and "Full clone" (preserves stage, jobs with telemetry, and creates a new branch from source). Full clone enables A/B testing of implementations while preserving complete execution history.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, Prisma 6.x, @octokit/rest, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E for browser-required features only)
**Target Platform**: Vercel (Linux server)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Full clone operation < 5 seconds (per SC-001)
**Constraints**: GitHub API rate limits, database transaction atomicity for job copying
**Scale/Scope**: Multi-tenant SaaS with per-project ticket management

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | Explicit types for all new functions, Zod validation for API inputs |
| II. Component-Driven | ✅ PASS | Uses shadcn/ui DropdownMenu, follows existing button patterns |
| III. Test-Driven (TDD) | ✅ PASS | Unit tests for slug generation, integration tests for API/DB, E2E only for dropdown UI interaction |
| IV. Security-First | ✅ PASS | Zod validation, verifyProjectAccess() authorization, no raw SQL |
| V. Database Integrity | ✅ PASS | Prisma transactions for multi-table job copying, maintains FK constraints |
| VI. AI-First Development | ✅ PASS | No human documentation files created |

**Gate Status**: PASSED - No violations. Proceeding with Phase 0 research.

## Project Structure

### Documentation (this feature)

```
specs/AIB-219-full-clone-option/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js App Router Structure
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── tickets/
│               └── [id]/
│                   └── duplicate/
│                       └── route.ts        # Extend with clone mode

components/
├── board/
│   └── ticket-detail-modal.tsx             # Replace button with dropdown
└── ui/
    └── dropdown-menu.tsx                   # Already exists (shadcn/ui)

lib/
├── db/
│   └── tickets.ts                          # Add fullCloneTicket() function
└── github/
    └── branch-operations.ts                # New: createBranchFromSource()

tests/
├── unit/
│   └── lib/
│       └── branch-slug.test.ts             # Branch name generation
├── integration/
│   └── tickets/
│       └── duplicate.test.ts               # Extend with full clone tests
└── e2e/
    └── ticket-duplication.spec.ts          # Dropdown menu interaction
```

**Structure Decision**: Extends existing Next.js App Router structure. New files only for branch operations utility (`lib/github/branch-operations.ts`). All other changes are modifications to existing files.

## Constitution Check (Post-Design)

*Re-evaluation after Phase 1 design completion*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | Contracts defined with explicit types in `contracts/*.ts` |
| II. Component-Driven | ✅ PASS | Uses existing shadcn/ui DropdownMenu pattern from ProjectMenu.tsx |
| III. Test-Driven (TDD) | ✅ PASS | Testing strategy defined: unit for branch naming, integration for API/DB, E2E for dropdown only |
| IV. Security-First | ✅ PASS | Authorization via verifyProjectAccess(), Zod validation for mode param |
| V. Database Integrity | ✅ PASS | Prisma $transaction ensures atomic ticket+jobs creation |
| VI. AI-First Development | ✅ PASS | quickstart.md is for AI agent implementation, not human tutorial |

**Post-Design Gate Status**: PASSED - Design adheres to all constitution principles.

## Complexity Tracking

*No constitution violations to justify*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
