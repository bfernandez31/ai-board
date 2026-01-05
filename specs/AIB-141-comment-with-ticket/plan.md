# Implementation Plan: Comment with Ticket and Command Autocomplete

**Branch**: `AIB-141-comment-with-ticket` | **Date**: 2026-01-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-141-comment-with-ticket/spec.md`

## Summary

Add two new autocomplete triggers to the comment textarea: `#` for ticket references and `/` for AI-BOARD commands. These extend the existing `@` mention autocomplete pattern with consistent UX. Typing `#` shows project tickets (inserting `#AIB-120` format), while `/` after `@ai-board` shows available commands with descriptions.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16, React 18, TanStack Query v5, shadcn/ui, Radix UI
**Storage**: PostgreSQL 14+ via Prisma 6.x (existing ticket data)
**Testing**: Vitest (unit + integration), Playwright (E2E for browser-required)
**Target Platform**: Web (modern browsers)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Autocomplete response <100ms, smooth keyboard navigation at 60fps
**Constraints**: 2-second polling for job status, <2000 char comment limit
**Scale/Scope**: ~100 tickets per project typical, single project context

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-Design Status | Justification |
|-----------|-------------------|---------------|
| I. TypeScript-First | ✅ Pass | All new code will use explicit types, no `any` |
| II. Component-Driven | ✅ Pass | Extend existing `MentionInput` pattern with shadcn/ui |
| III. Test-Driven | ✅ Pass | RTL component tests for interactive UI, Vitest integration for API |
| IV. Security-First | ✅ Pass | Ticket access via existing `verifyProjectAccess`, command list static |
| V. Database Integrity | ✅ Pass | Read-only queries for ticket/command lists, no schema changes |
| VI. AI-First | ✅ Pass | No human documentation created |

**Gate Status**: ✅ All gates pass - proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/AIB-141-comment-with-ticket/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
components/comments/
├── mention-input.tsx           # MODIFY: Add #ticket and /command triggers
├── user-autocomplete.tsx       # REFERENCE: Pattern for new dropdowns
├── ticket-autocomplete.tsx     # NEW: Ticket selection dropdown
└── command-autocomplete.tsx    # NEW: Command selection dropdown

app/lib/
├── types/
│   └── mention.ts              # MODIFY: Add Ticket and Command types
├── utils/
│   └── mention-parser.ts       # REFERENCE: Pattern for ticket/command formatting
├── hooks/queries/
│   └── use-tickets.ts          # NEW: Query hook for project tickets
└── data/
    └── ai-board-commands.ts    # NEW: Static command definitions

app/api/projects/[projectId]/tickets/
└── route.ts                    # Existing: GET returns tickets for autocomplete

tests/
├── unit/components/
│   ├── ticket-autocomplete.test.tsx  # NEW: Component tests
│   └── command-autocomplete.test.tsx # NEW: Component tests
└── integration/
    └── comments/
        └── autocomplete.test.ts      # NEW: Integration tests
```

**Structure Decision**: Web application (Next.js App Router). Extend existing `components/comments/` pattern with new autocomplete components. No backend changes needed—existing ticket API serves autocomplete data.

## Complexity Tracking

*No violations to justify - all constitution gates pass.*

---

## Post-Design Constitution Re-Check

| Principle | Post-Design Status | Verification |
|-----------|-------------------|--------------|
| I. TypeScript-First | ✅ Pass | `AIBoardCommand`, `TicketSearchResult` interfaces defined with explicit types |
| II. Component-Driven | ✅ Pass | New components follow `UserAutocomplete` shadcn/ui pattern |
| III. Test-Driven | ✅ Pass | RTL tests for dropdowns, Vitest integration for search API |
| IV. Security-First | ✅ Pass | Uses existing `verifyProjectAccess`; no raw SQL; static command list |
| V. Database Integrity | ✅ Pass | Read-only queries; no schema migrations |
| VI. AI-First | ✅ Pass | Only spec artifacts created; no human guides |

**Final Gate Status**: ✅ All gates pass - ready for task generation

---

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Plan | `specs/AIB-141-comment-with-ticket/plan.md` | This file |
| Research | `specs/AIB-141-comment-with-ticket/research.md` | Decision log and research findings |
| Data Model | `specs/AIB-141-comment-with-ticket/data-model.md` | Entity definitions and relationships |
| API Contract | `specs/AIB-141-comment-with-ticket/contracts/ticket-search-api.md` | Existing endpoint documentation |
| Commands Contract | `specs/AIB-141-comment-with-ticket/contracts/ai-board-commands.md` | Static command data contract |
| Quickstart | `specs/AIB-141-comment-with-ticket/quickstart.md` | Implementation guide |

---

## Next Steps

Run `/speckit.tasks` to generate the task list for implementation.
