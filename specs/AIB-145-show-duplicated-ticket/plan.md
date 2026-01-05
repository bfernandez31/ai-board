# Implementation Plan: Show Duplicated Ticket

**Branch**: `AIB-145-show-duplicated-ticket` | **Date**: 2026-01-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-145-show-duplicated-ticket/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix the duplicated ticket not appearing in INBOX without page refresh. Root cause is a **cache key mismatch** in `ticket-detail-modal.tsx`: the duplicate handler invalidates `['tickets', projectId]` but the board uses `['projects', projectId, 'tickets']`. The fix requires correcting the cache invalidation key and optionally adding optimistic updates for better UX.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16, React 18, TanStack Query v5.90.5
**Storage**: PostgreSQL 14+ via Prisma 6.x
**Testing**: Vitest (unit + integration), RTL for component tests
**Target Platform**: Web browser (Next.js App Router)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Duplicated ticket visible within 1 second of API response (SC-001)
**Constraints**: Must not require page refresh (FR-002)
**Scale/Scope**: Single modal component fix + RTL component test

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement | Status |
|------|-------------|--------|
| I. TypeScript-First | All code in TypeScript strict mode, explicit types | ✅ PASS - Existing codebase compliant |
| II. Component-Driven | Use shadcn/ui, feature-based folder structure | ✅ PASS - Modal already uses shadcn |
| III. Test-Driven | Tests verify behavior, Testing Trophy architecture | ✅ PASS - RTL component test planned per spec |
| IV. Security-First | Input validation, no exposed secrets | ✅ PASS - No security changes required |
| V. Database Integrity | Prisma migrations, transactions | ✅ PASS - No schema changes |
| VI. AI-First Development | No human-oriented documentation | ✅ PASS - No docs created |

**Pre-Design Gate**: PASSED - All constitution requirements met

## Project Structure

### Documentation (this feature)

```
specs/AIB-145-show-duplicated-ticket/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - Root cause analysis
├── data-model.md        # Phase 1 output - N/A (no new entities)
├── quickstart.md        # Phase 1 output - Implementation steps
├── contracts/           # Phase 1 output - N/A (no new APIs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# Next.js Web Application Structure
components/
├── board/
│   └── ticket-detail-modal.tsx    # FIX: handleDuplicate cache key
app/
├── lib/
│   ├── hooks/
│   │   └── mutations/
│   │       └── useDuplicateTicket.ts  # OPTIONAL: Extract mutation hook
│   └── query-keys.ts                  # Existing: Correct cache keys
tests/
└── unit/
    └── components/
        └── ticket-detail-modal.test.tsx  # ADD: RTL component test
```

**Structure Decision**: Next.js web application - fixing existing component, adding RTL component test. No new directories needed.

## Complexity Tracking

*No constitution violations - simple bug fix with minimal changes.*

## Post-Design Constitution Re-Check

| Gate | Requirement | Status |
|------|-------------|--------|
| I. TypeScript-First | All types explicit, no `any` | ✅ PASS - Uses existing `TicketWithVersion` type |
| II. Component-Driven | No new UI primitives created | ✅ PASS - Modifying existing modal component |
| III. Test-Driven | RTL component test covers behavior | ✅ PASS - Test verifies duplicate-and-display |
| IV. Security-First | No new attack surfaces | ✅ PASS - Client-side cache fix only |
| V. Database Integrity | No schema changes | ✅ PASS - N/A |
| VI. AI-First Development | No human docs created | ✅ PASS - Spec artifacts only |

**Post-Design Gate**: PASSED

## Implementation Approach

### Minimal Fix (Recommended)
1. **Fix cache key**: Change `['tickets', projectId]` to `queryKeys.projects.tickets(projectId)`
2. **Add optimistic update**: Insert temporary ticket before API call, rollback on error
3. **Add RTL test**: Verify duplicate triggers cache update

### Files to Modify
| File | Change |
|------|--------|
| `components/board/ticket-detail-modal.tsx` | Fix `handleDuplicate` function |
| `tests/unit/components/ticket-detail-modal.test.tsx` | Add duplicate behavior test |

### Dependencies
- Import `queryKeys` from `@/app/lib/query-keys`
- Import `TicketWithVersion` from `@/app/lib/types/query-types`

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Plan | `specs/AIB-145-show-duplicated-ticket/plan.md` | ✅ Complete |
| Research | `specs/AIB-145-show-duplicated-ticket/research.md` | ✅ Complete |
| Data Model | `specs/AIB-145-show-duplicated-ticket/data-model.md` | ✅ Complete (N/A noted) |
| Contracts | `specs/AIB-145-show-duplicated-ticket/contracts/` | ✅ Complete (N/A noted) |
| Quickstart | `specs/AIB-145-show-duplicated-ticket/quickstart.md` | ✅ Complete |
