# Research: Add AI Agent Selection to Data Model

**Branch**: `AIB-228-add-ai-agent` | **Date**: 2026-03-04

## Research Summary

No NEEDS CLARIFICATION items — the spec is fully resolved and the codebase provides an exact precedent via the `clarificationPolicy` inheritance pattern.

## Decision 1: Enum Implementation Strategy

**Decision**: Use Prisma native enum (`Agent`) with values `CLAUDE` and `CODEX`, matching the existing `ClarificationPolicy` enum pattern.

**Rationale**: The codebase already uses Prisma enums (ClarificationPolicy, Stage, WorkflowType, JobCommand, JobStatus). Native enums provide compile-time safety and database-level validation.

**Alternatives considered**:
- String field with application-level validation — rejected because it loses database-level constraints and doesn't match existing patterns
- Separate `Agent` table with foreign keys — rejected as over-engineering for a small, stable set of values

## Decision 2: Inheritance Pattern

**Decision**: Follow the exact `clarificationPolicy` pattern: Project has required field with default, Ticket has nullable field (null = inherit project default).

**Rationale**: The `clarificationPolicy` inheritance pattern is already proven in the codebase:
- `Project.clarificationPolicy: ClarificationPolicy @default(AUTO)` (required)
- `Ticket.clarificationPolicy: ClarificationPolicy?` (nullable)
- Resolution via `ticket.clarificationPolicy ?? project.clarificationPolicy`
- Zod schemas: project-level non-nullable, ticket-level nullable
- Stage restriction: editable only in INBOX via `canEditDescriptionAndPolicy()`

**Alternatives considered**:
- Eager resolution (stamp agent on ticket at creation) — rejected because spec requires dynamic inheritance (FR-005, US-2 scenario 3)
- Separate resolution table — rejected as unnecessary complexity

## Decision 3: Default Value

**Decision**: `CLAUDE` as the default for `Project.defaultAgent`, matching the current system behavior.

**Rationale**: The system is 100% Claude Code today. All existing projects must continue working identically (SC-001). CLAUDE as default requires zero data migration.

## Decision 4: Field Editability

**Decision**: `agent` field on tickets follows same editability rules as `clarificationPolicy` — editable only in INBOX stage.

**Rationale**: Spec assumption states this explicitly. The existing `canEditDescriptionAndPolicy()` function in `lib/utils/field-edit-permissions.ts` already gates INBOX-only edits. This function should be extended to cover agent as well.

## Decision 5: API Changes Scope

**Decision**: Extend existing endpoints (no new routes needed):
- `PATCH /api/projects/[projectId]` — add `defaultAgent` to accepted fields
- `POST /api/projects/[projectId]/tickets` — add optional `agent` to creation
- `PATCH /api/projects/[projectId]/tickets/[id]` — add `agent` to update fields

**Rationale**: Spec FR-006 through FR-008 require these capabilities. Extending existing endpoints matches the pattern used for `clarificationPolicy` and avoids breaking changes (FR-003, SC-001).

## Decision 6: No UI Changes

**Decision**: This ticket is data model and API only — no frontend/UI changes.

**Rationale**: Spec explicitly states "No UI changes are included in this ticket — this is a data model and API-only change." UI for agent selection will be a subsequent ticket.
