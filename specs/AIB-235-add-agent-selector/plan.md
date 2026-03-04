# Implementation Plan: Add Agent Selector UI on Tickets and Project Settings

**Branch**: `AIB-235-add-agent-selector` | **Date**: 2026-03-04 | **Spec**: `specs/AIB-235-add-agent-selector/spec.md`
**Input**: Feature specification from `/specs/AIB-235-add-agent-selector/spec.md`
**Depends On**: AIB-228 (Agent data model — already merged)

## Summary

Add UI components for agent selection across the application: project settings card, ticket creation dropdown, ticket detail editing, kanban board badge, and quick-impl modal selector. The backend (Prisma schema, API routes, validation schemas) is already complete from AIB-228 — this ticket is **UI-only**.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, shadcn/ui, TailwindCSS 3.4, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma ORM (no schema changes needed)
**Testing**: Vitest (unit + component), Playwright (E2E — not needed)
**Target Platform**: Vercel (Next.js)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Agent selector renders within existing page load budget; no new API calls beyond existing endpoints
**Constraints**: Must follow existing clarification policy UI patterns exactly; must use shadcn/ui components exclusively
**Scale/Scope**: ~10 files (5 new components, 1 new utility, 4 existing files modified)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new components use strict TypeScript with explicit types. Agent enum imported from `@prisma/client`. |
| II. Component-Driven Architecture | PASS | All UI uses shadcn/ui primitives (Card, Select, Badge, Dialog). Feature components in `components/settings/` and `components/board/`. Client Components only where interactivity required. |
| III. Test-Driven Development | PASS | Component tests (Vitest + RTL) for interactive UI (settings card, edit dialog, badge). Integration tests for agent field in existing API test suites. No E2E needed (no browser-required features). |
| IV. Security-First Design | PASS | All inputs validated via existing Zod schemas. Authorization via existing `verifyProjectOwnership`/`verifyProjectAccess`. Read-only enforcement for non-INBOX tickets already in API. |
| V. Database Integrity | PASS | No schema changes. Existing Agent enum, Project.defaultAgent, and Ticket.agent fields from AIB-228. |
| VI. AI-First Development | PASS | No documentation files at project root. All artifacts in `specs/AIB-235-add-agent-selector/`. |

**Post-Phase 1 Re-check**: All gates still PASS. No violations introduced.

## Project Structure

### Documentation (this feature)

```
specs/AIB-235-add-agent-selector/
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
app/
└── lib/
    └── utils/
        └── agent-icons.ts           # NEW: getAgentIcon, getAgentLabel, getAgentDescription

app/
└── projects/
    └── [projectId]/
        └── settings/
            └── page.tsx             # MODIFY: Add <DefaultAgentCard>

components/
├── settings/
│   └── default-agent-card.tsx       # NEW: Mirror of ClarificationPolicyCard
├── board/
│   ├── new-ticket-modal.tsx         # MODIFY: Add agent <Select> field
│   ├── ticket-detail-modal.tsx      # MODIFY: Add AgentBadge + AgentEditDialog trigger
│   ├── ticket-card.tsx              # MODIFY: Add agent badge in header row
│   └── quick-impl-modal.tsx         # MODIFY: Add agent selector
└── tickets/
    └── agent-edit-dialog.tsx         # NEW: Mirror of PolicyEditDialog

tests/
├── unit/
│   ├── agent-icons.test.ts          # NEW: Unit tests for utility functions
│   └── components/
│       ├── default-agent-card.test.tsx   # NEW: Component test
│       └── agent-edit-dialog.test.tsx    # NEW: Component test
└── integration/
    └── tickets/
        └── [extend existing]        # Extend to verify agent badge rendering context
```

### Key Existing Files (Backend — already complete from AIB-228)

| File | What's Already Done |
|------|-------------------|
| `prisma/schema.prisma` | Agent enum (CLAUDE, CODEX), Project.defaultAgent, Ticket.agent |
| `app/lib/schemas/clarification-policy.ts` | `projectUpdateSchema` accepts `defaultAgent` |
| `lib/validations/ticket.ts` | `CreateTicketSchema` and `patchTicketSchema` accept `agent` |
| `app/api/projects/[projectId]/route.ts` | PATCH accepts `defaultAgent` |
| `app/api/projects/[projectId]/tickets/route.ts` | POST accepts `agent` |
| `app/api/projects/[projectId]/tickets/[id]/route.ts` | PATCH accepts `agent` (INBOX-only restriction) |
| `lib/types.ts` | `TicketWithVersion` includes `agent` and `project.defaultAgent` |

## Design Decisions

### D1: Agent Utility Pattern (mirrors policy-icons.ts)
Create `app/lib/utils/agent-icons.ts` with `getAgentIcon()`, `getAgentLabel()`, `getAgentDescription()` following the exact pattern of `app/lib/utils/policy-icons.ts`.

### D2: DefaultAgentCard (mirrors ClarificationPolicyCard)
New `components/settings/default-agent-card.tsx` following the exact pattern of `components/settings/clarification-policy-card.tsx`. Uses `PATCH /api/projects/${project.id}` with `{ defaultAgent }`.

### D3: Agent Badge on Ticket Cards
Add a small `<Badge>` in the ticket card header row (alongside QUICK/CLEAN badges). Shows agent label text. Inherited agents use muted styling with "(default)" suffix. Explicit agents use normal badge styling.

### D4: Agent Select in New Ticket Modal
Add an agent `<Select>` field in the new ticket modal, following the identical pattern of the clarification policy select that already exists. Uses `"project-default"` sentinel value; `undefined` in form state = inherit from project.

### D5: Agent Edit in Ticket Detail Modal
Add `AgentBadge` display + "Edit Agent" button (visible only in INBOX stage) + `AgentEditDialog`. Follows the exact pattern of PolicyBadge + "Edit Policy" button + PolicyEditDialog.

### D6: Agent Select in Quick-Impl Modal
Extend `QuickImplModal` props to accept `defaultAgent` and return selected agent via `onConfirm`. Add a `<Select>` inside the modal body between the benefits/trade-offs sections and the warning box.

### D7: Read-Only for Non-Owners in Settings
The DefaultAgentCard follows the same read-only pattern as ClarificationPolicyCard. Only project owners can change the default agent. Members see it as read-only (disabled select).

## Complexity Tracking

No constitution violations. No complexity justifications needed. All components follow established patterns with zero novel abstractions.
