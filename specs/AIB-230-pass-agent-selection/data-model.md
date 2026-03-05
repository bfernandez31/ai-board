# Data Model: Pass Agent Selection Through Workflow Dispatch Pipeline

**Branch**: `AIB-230-pass-agent-selection` | **Date**: 2026-03-05

## Existing Entities (No Schema Changes Required)

This feature requires **zero database schema changes**. All necessary data model elements already exist.

### Agent Enum (Existing)

```prisma
enum Agent {
  CLAUDE
  CODEX
}
```

**Location**: `prisma/schema.prisma:283-286`

### Ticket Model (Existing Fields)

| Field | Type | Description |
|-------|------|-------------|
| `agent` | `Agent?` | Optional per-ticket agent override. Null = use project default |

**Location**: `prisma/schema.prisma:127`

### Project Model (Existing Fields)

| Field | Type | Description |
|-------|------|-------------|
| `defaultAgent` | `Agent` | Project-level default agent. `@default(CLAUDE)` |

**Location**: `prisma/schema.prisma:73`

## Agent Resolution Chain

```
ticket.agent ?? ticket.project.defaultAgent ?? Agent.CLAUDE
```

- **Level 1**: Ticket-level override (if set)
- **Level 2**: Project-level default (always set, defaults to CLAUDE)
- **Level 3**: System-wide fallback (CLAUDE) — defensive only, since Project.defaultAgent has a schema default

## Payload Modifications

### specifyPayload (Embedded)

```typescript
// Before
{ ticketKey, title, description, clarificationPolicy }

// After
{ ticketKey, title, description, clarificationPolicy, agent }
```

### quickImplPayload (Embedded)

```typescript
// Before
{ ticketKey, title, description }

// After
{ ticketKey, title, description, agent }
```

### Verify Workflow Inputs (Discrete)

```typescript
// Before
{ ticket_id, job_id, project_id, branch, workflowType, githubRepository }

// After
{ ticket_id, job_id, project_id, branch, workflowType, githubRepository, agent }
```

### Cleanup Workflow Inputs (Discrete)

```typescript
// Before
{ ticket_id, project_id, job_id, githubRepository }

// After
{ ticket_id, project_id, job_id, githubRepository, agent }
```

### AI-BOARD Assist Workflow Inputs (Discrete)

```typescript
// Before
{ ticket_id, stage, branch, user_id, user, comment, job_id, project_id, githubRepository }

// After
{ ticket_id, stage, branch, user_id, user, comment, job_id, project_id, githubRepository, agent }
```

### Iterate Workflow Inputs (Discrete)

```typescript
// Before
{ ticket_id, job_id, project_id, branch, issues_to_fix, githubRepository }

// After
{ ticket_id, job_id, project_id, branch, issues_to_fix, githubRepository, agent }
```

## State Transitions

No state transitions are affected. The agent value is read-only during workflow dispatch — it flows from database to workflow inputs but doesn't change state.

## Validation

Agent values are already validated at the database level via the Prisma `Agent` enum. No additional validation is needed in the dispatch pipeline since the value originates from the database (not user input at dispatch time).
