# Implementation Summary: Add AI Agent Selection to Data Model (Ticket + Project)

**Branch**: `AIB-228-add-ai-agent` | **Date**: 2026-03-04
**Spec**: [spec.md](spec.md)

## Changes Summary

Added `Agent` enum (CLAUDE, CODEX) to Prisma schema with `defaultAgent` on Project (default: CLAUDE) and nullable `agent` on Ticket. Project owners can set defaultAgent via PATCH. Tickets inherit project default when agent is null, or override with explicit agent. Agent field editable only in INBOX stage (same rule as clarificationPolicy). Resolution utility `resolveEffectiveAgent()` provides fallback logic.

## Key Decisions

- Mirrored existing `clarificationPolicy` pattern for consistency across schemas, validations, API routes, and DB layer
- Agent field on Ticket is nullable (null = inherit project default) rather than copying project default at creation time
- Reused `canEditDescriptionAndPolicy()` gate for INBOX-only editability rather than creating a separate permission function
- Extended all ticket data flows (getTicketsByStage, getTicketsWithJobs, duplicate, clone) for completeness

## Files Modified

- `prisma/schema.prisma` — Agent enum, Project.defaultAgent, Ticket.agent
- `app/lib/schemas/agent.ts` — Zod validation schemas (new)
- `app/lib/utils/agent-resolution.ts` — resolveEffectiveAgent utility (new)
- `lib/validations/ticket.ts` — agent field in CreateTicketSchema, patchTicketSchema
- `app/lib/schemas/clarification-policy.ts` — defaultAgent in projectUpdateSchema
- `lib/db/projects.ts`, `lib/db/tickets.ts` — DB layer updates
- `app/api/projects/[projectId]/route.ts` — Project PATCH
- `app/api/projects/[projectId]/tickets/route.ts` — Ticket POST
- `app/api/projects/[projectId]/tickets/[id]/route.ts` — Ticket GET/PATCH
- `lib/types.ts`, `app/lib/types/query-types.ts` — Type definitions
- `tests/unit/agent-*.test.ts`, `tests/integration/projects/settings.test.ts`, `tests/integration/tickets/crud.test.ts`

## ⚠️ Manual Requirements

None
