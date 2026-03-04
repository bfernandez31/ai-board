# Implementation Plan: Add AI Agent Selection to Data Model

**Branch**: `AIB-228-add-ai-agent` | **Date**: 2026-03-04 | **Spec**: `specs/AIB-228-add-ai-agent/spec.md`
**Input**: Feature specification from `/specs/AIB-228-add-ai-agent/spec.md`

## Summary

Add an `Agent` enum (CLAUDE, CODEX) to the Prisma data model with project-level defaults and ticket-level overrides. Follows the identical inheritance pattern already established by `clarificationPolicy`: Project has a required `defaultAgent` field defaulting to CLAUDE; Ticket has a nullable `agent` field where null means inherit from project. No UI changes — data model and API only.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, Zod, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E — not needed for this ticket)
**Target Platform**: Vercel (Next.js)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: N/A (data model change, no performance-sensitive paths)
**Constraints**: Zero-downtime migration, backward compatibility with all existing data
**Scale/Scope**: 2 models modified (Project, Ticket), 1 new enum, ~10 files changed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code uses strict TypeScript with explicit types. Agent enum generates TS types via Prisma. Zod schemas provide runtime validation. |
| II. Component-Driven Architecture | PASS | No UI changes in this ticket. API routes follow existing `/app/api/[resource]/route.ts` pattern. |
| III. Test-Driven Development | PASS | Integration tests for API endpoints, unit tests for resolution utility and Zod schemas. No E2E needed (no browser-required features). |
| IV. Security-First Design | PASS | Zod validation on all inputs. Prisma parameterized queries. Authorization via existing `verifyProjectOwnership`/`verifyProjectAccess` helpers. |
| V. Database Integrity | PASS | Prisma migration with enum constraint. Nullable field with explicit null handling. Default values for backward compatibility. |
| VI. AI-First Development | PASS | No documentation files created at project root. All artifacts in `specs/AIB-228-add-ai-agent/`. |

**Post-Phase 1 Re-check**: All gates still PASS. No violations introduced.

## Project Structure

### Documentation (this feature)

```
specs/AIB-228-add-ai-agent/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-contracts.md # Phase 1 output
└── tasks.md             # Phase 2 output (created by /ai-board.tasks)
```

### Source Code (repository root)

```
prisma/
└── schema.prisma              # Add Agent enum, extend Project + Ticket models

app/
├── api/
│   └── projects/
│       └── [projectId]/
│           ├── route.ts       # Extend PATCH to accept defaultAgent
│           └── tickets/
│               ├── route.ts   # Extend POST to accept agent
│               └── [id]/
│                   └── route.ts  # Extend PATCH to accept agent
└── lib/
    ├── schemas/
    │   └── agent.ts           # New: Zod validation schemas
    └── utils/
        └── agent-resolution.ts # New: resolveEffectiveAgent()

lib/
├── db/
│   ├── projects.ts            # Extend updateProject()
│   └── tickets.ts             # Extend createTicket() + update logic
├── validations/
│   └── ticket.ts              # Extend CreateTicketSchema + patchTicketSchema
└── utils/
    └── field-edit-permissions.ts # Verify agent uses same INBOX-only rule

tests/
├── unit/
│   ├── agent-resolution.test.ts    # Unit tests for resolveEffectiveAgent
│   └── agent-schema.test.ts        # Unit tests for Zod validation
└── integration/
    ├── projects/
    │   └── [extend existing]       # Test defaultAgent in project PATCH
    └── tickets/
        └── [extend existing]       # Test agent in ticket create/update
```

**Structure Decision**: Existing Next.js App Router structure. New files follow established conventions — `app/lib/schemas/` for Zod schemas, `app/lib/utils/` for pure utilities, `lib/db/` for database functions.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
