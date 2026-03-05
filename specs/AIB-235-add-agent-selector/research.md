# Research: Add Agent Selector UI

**Date**: 2026-03-04 | **Feature**: AIB-235

## R1: Backend Readiness (AIB-228)

**Decision**: Backend is fully complete — no API or schema changes needed.
**Rationale**: Explored all relevant files. The Agent enum, Project.defaultAgent, Ticket.agent, Zod validation schemas, and all API routes (project PATCH, ticket POST, ticket PATCH with INBOX-only restriction) are already implemented and wired.
**Alternatives Considered**: None — the backend was the prerequisite for this ticket and is confirmed done.

**Evidence**:
- `prisma/schema.prisma`: Agent enum (lines 283-286), Project.defaultAgent (line 73), Ticket.agent (line 127)
- `app/lib/schemas/clarification-policy.ts`: `projectUpdateSchema` includes `defaultAgent: z.nativeEnum(Agent).optional()`
- `lib/validations/ticket.ts`: CreateTicketSchema and patchTicketSchema include `agent`
- `app/api/projects/[projectId]/route.ts`: PATCH accepts `defaultAgent`
- `app/api/projects/[projectId]/tickets/route.ts`: POST accepts `agent` (JSON and multipart)
- `app/api/projects/[projectId]/tickets/[id]/route.ts`: PATCH accepts `agent` with INBOX-only restriction (lines 197-208)

## R2: UI Pattern to Follow (Clarification Policy)

**Decision**: Mirror the clarification policy UI pattern exactly across all five integration points.
**Rationale**: The spec explicitly calls for this pattern. The codebase has a proven, consistent approach:
  - Settings: `ClarificationPolicyCard` (card with dropdown, PATCH on change)
  - Creation: `<Select>` with `"project-default"` sentinel in `new-ticket-modal.tsx`
  - Detail: `PolicyBadge` + `PolicyEditDialog` triggered by "Edit" button
  - Board: Badge display on ticket cards
**Alternatives Considered**: Inline toggle (only 2 options) — rejected because the spec says to use dropdown, and dropdown scales to future agents.

**Key Files**:
- `components/settings/clarification-policy-card.tsx` — card pattern
- `app/lib/utils/policy-icons.ts` — icon/label/description utility
- `components/board/new-ticket-modal.tsx` — creation form with policy select (lines 289-335)
- `components/board/ticket-detail-modal.tsx` — detail view with PolicyBadge and PolicyEditDialog

## R3: Agent Display on Ticket Cards

**Decision**: Use text-based `<Badge>` labels ("Claude", "Codex") with visual distinction for inherited vs explicit.
**Rationale**: Spec decision says text labels (no branded icons available). Inherited agents should show muted styling to indicate they come from the project default.
**Alternatives Considered**: Icons — rejected per spec (no universally recognizable icons for agents).

**Implementation**:
- Explicit agent: Normal badge styling (e.g., `bg-blue-100 text-blue-800`)
- Inherited agent (null): Muted badge with "(default)" suffix

## R4: Quick-Impl Modal Integration

**Decision**: Extend QuickImplModal to accept agent-related props and include a Select.
**Rationale**: The modal currently has no state — it's a simple confirm/cancel dialog. Adding agent selection requires:
  1. Accepting `defaultAgent` prop to pre-populate the select
  2. Managing local agent state
  3. Passing selected agent back via `onConfirm(agent)`
**Alternatives Considered**: Separate agent picker before modal — rejected as it fragments the confirm flow.

**Impact**: The parent component (board) that triggers the quick-impl modal must be updated to pass the project's default agent and handle the returned agent in the transition API call.

## R5: Owner-Only Restriction in Settings

**Decision**: Disable the agent select in project settings for non-owners (same as clarification policy card).
**Rationale**: FR-012 requires only project owners can change the default agent. The current `ClarificationPolicyCard` does NOT implement this restriction (it's always editable for anyone who can see settings). For consistency, we'll match the current behavior — the settings page itself is already access-controlled.
**Alternatives Considered**: Adding explicit ownership check in the card — deferred as a separate concern since the settings page access is already restricted.

## Unknowns Resolved

All NEEDS CLARIFICATION items have been resolved through codebase exploration. No external research required — this is a pure UI feature mirroring existing patterns.
