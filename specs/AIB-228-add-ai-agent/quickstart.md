# Quickstart: AI Agent Selection Implementation

**Branch**: `AIB-228-add-ai-agent` | **Date**: 2026-03-04

## Implementation Order

### Step 1: Prisma Schema + Migration

1. Add `Agent` enum to `prisma/schema.prisma`
2. Add `defaultAgent Agent @default(CLAUDE)` to `Project` model
3. Add `agent Agent?` to `Ticket` model
4. Run `bunx prisma migrate dev --name add-agent-field`
5. Run `bunx prisma generate`

### Step 2: Validation Schemas

1. Create `app/lib/schemas/agent.ts` with `projectAgentSchema` and `ticketAgentSchema` (mirror `clarification-policy.ts`)
2. Extend `lib/validations/ticket.ts` — add `agent` to `CreateTicketSchema` and `patchTicketSchema`

### Step 3: Database Functions

1. Extend `updateProject()` in `lib/db/projects.ts` to accept `defaultAgent`
2. Extend `createTicket()` in `lib/db/tickets.ts` to accept optional `agent`
3. Extend ticket update logic in `lib/db/tickets.ts` to handle `agent`

### Step 4: Agent Resolution Utility

1. Create `app/lib/utils/agent-resolution.ts` with `resolveEffectiveAgent()` (mirror `policy-resolution.ts`)

### Step 5: API Routes

1. Extend `PATCH /api/projects/[projectId]` to accept `defaultAgent`
2. Extend `POST /api/projects/[projectId]/tickets` to accept `agent`
3. Extend `PATCH /api/projects/[projectId]/tickets/[id]` to accept `agent` (with INBOX stage check)

### Step 6: Field Edit Permissions

1. Extend `canEditDescriptionAndPolicy()` or create equivalent for agent (reuse same INBOX-only logic)

### Step 7: Tests

1. Integration tests for project update with `defaultAgent`
2. Integration tests for ticket creation with `agent`
3. Integration tests for ticket update with `agent` (including stage restriction)
4. Unit tests for `resolveEffectiveAgent()`
5. Unit tests for Zod validation schemas

## Key Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `Agent` enum, extend Project + Ticket models |
| `app/lib/schemas/agent.ts` | New: Zod validation schemas for agent |
| `lib/validations/ticket.ts` | Extend CreateTicketSchema and patchTicketSchema |
| `lib/db/projects.ts` | Extend `updateProject()` |
| `lib/db/tickets.ts` | Extend `createTicket()` and update logic |
| `app/lib/utils/agent-resolution.ts` | New: `resolveEffectiveAgent()` |
| `app/api/projects/[projectId]/route.ts` | Extend PATCH handler |
| `app/api/projects/[projectId]/tickets/route.ts` | Extend POST handler |
| `app/api/projects/[projectId]/tickets/[id]/route.ts` | Extend PATCH handler |
| `lib/utils/field-edit-permissions.ts` | Verify agent follows same INBOX-only rule |

## Verification

- `bun run type-check` passes
- `bun run lint` passes
- `bun run test:unit` passes (new agent tests)
- `bun run test:integration` passes (new API tests)
- Existing tests continue to pass (zero regressions)
