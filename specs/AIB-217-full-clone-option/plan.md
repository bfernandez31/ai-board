# Implementation Plan: Full Clone Option for Ticket Duplication

**Branch**: `AIB-217-full-clone-option` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-217-full-clone-option/spec.md`

## Summary

Implement a "Full clone" option for ticket duplication that preserves the ticket's current stage, creates a new Git branch forked from the source branch, and deep-copies all job records with telemetry data. This enables users to test alternative implementations from any workflow checkpoint without affecting the original ticket. The existing "Simple copy" behavior (INBOX stage, no branch/jobs) remains available via a dropdown menu.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5, shadcn/ui, Prisma 6.x, Octokit (@octokit/rest)
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests only)
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Clone operation completes within 5 seconds (SC-005)
**Constraints**: Must use database transactions for atomicity (FR-015), must handle missing source branches gracefully (Edge Case)
**Scale/Scope**: Single-tenant project management application, ~100 concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All code in TypeScript strict mode, explicit types required |
| II. Component-Driven | ✅ PASS | Using shadcn/ui DropdownMenu, feature folder structure |
| III. Test-Driven | ✅ PASS | Testing Trophy: Vitest integration tests for API, unit tests for utils |
| IV. Security-First | ✅ PASS | Zod validation, Prisma parameterized queries, verifyProjectAccess |
| V. Database Integrity | ✅ PASS | Prisma transactions for multi-table operations (ticket + jobs) |
| VI. AI-First Development | ✅ PASS | No README/guide files, follows existing code patterns |

**Pre-Design Gate**: PASSED - No blocking violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-217-full-clone-option/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── clone-api.yaml   # OpenAPI schema for clone endpoint
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── api/
│   └── projects/[projectId]/tickets/[id]/
│       ├── duplicate/route.ts    # MODIFY: Add fullClone query param support
│       └── clone/route.ts        # NEW: Dedicated full clone endpoint (alternative)

components/
├── board/
│   └── ticket-detail-modal.tsx   # MODIFY: Replace Duplicate button with dropdown

lib/
├── db/
│   └── tickets.ts                # MODIFY: Add fullCloneTicket function
├── github/
│   └── create-branch-from.ts     # NEW: Branch fork utility using Octokit
└── validations/
    └── ticket.ts                 # MODIFY: Add clone validation schema

tests/
├── integration/
│   └── tickets/
│       └── clone.test.ts         # NEW: Full clone API integration tests
└── unit/
    └── create-branch-from.test.ts # NEW: GitHub branch creation tests
```

**Structure Decision**: Extending existing web application structure with minimal new files. Prefer modifying existing duplicate endpoint over creating separate clone endpoint to maintain API consistency.

## Complexity Tracking

*No violations requiring justification - design follows existing patterns.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. TypeScript-First | ✅ PASS | All new functions have explicit parameter/return types in quickstart.md |
| II. Component-Driven | ✅ PASS | Using existing shadcn/ui DropdownMenu; no custom UI primitives |
| III. Test-Driven | ✅ PASS | Test files specified: unit for GitHub util, integration for API endpoint |
| IV. Security-First | ✅ PASS | Zod validation for query params; verifyProjectAccess before clone |
| V. Database Integrity | ✅ PASS | Prisma $transaction ensures atomicity; soft delete not applicable (copy, not delete) |
| VI. AI-First Development | ✅ PASS | quickstart.md provides implementation guidance without human-oriented tutorials |

**Post-Design Gate**: PASSED - Design adheres to all constitution principles.

---

## Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| research.md | `specs/AIB-217-full-clone-option/research.md` | ✅ Complete |
| data-model.md | `specs/AIB-217-full-clone-option/data-model.md` | ✅ Complete |
| contracts/ | `specs/AIB-217-full-clone-option/contracts/clone-api.yaml` | ✅ Complete |
| quickstart.md | `specs/AIB-217-full-clone-option/quickstart.md` | ✅ Complete |
| Agent context | CLAUDE.md updated | ✅ Complete |
