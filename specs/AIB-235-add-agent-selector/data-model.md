# Data Model: Add Agent Selector UI

**Date**: 2026-03-04 | **Feature**: AIB-235

## Existing Entities (from AIB-228 — no changes needed)

### Agent (Enum)

| Value | Description |
|-------|-------------|
| `CLAUDE` | Anthropic Claude Code agent |
| `CODEX` | OpenAI Codex agent |

### Project.defaultAgent

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `defaultAgent` | `Agent` | Yes | `CLAUDE` | Project-level default agent for all new tickets |

### Ticket.agent

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agent` | `Agent?` | No | `null` | Ticket-level agent override. Null = inherit from project |

### Resolution Logic

```
effectiveAgent = ticket.agent ?? project.defaultAgent
```

### State Transitions

| Ticket Stage | Agent Editable? | Notes |
|-------------|----------------|-------|
| INBOX | Yes | User can change agent before workflow starts |
| SPECIFY | No (read-only) | Agent locked once workflow begins |
| PLAN | No (read-only) | — |
| BUILD | No (read-only) | — |
| VERIFY | No (read-only) | — |
| SHIP | No (read-only) | — |

**Rollback**: When a ticket moves back to INBOX (from any stage), the agent becomes editable again.

## UI Component Data Flow

### Project Settings

```
Settings Page (Server Component)
  └─ Fetches project.defaultAgent
      └─ <DefaultAgentCard project={{ id, defaultAgent }}>
          └─ PATCH /api/projects/:id { defaultAgent }
              └─ router.refresh()
```

### Ticket Creation

```
New Ticket Modal
  └─ Receives project.defaultAgent as pre-selected value
      └─ <Select> with "project-default" sentinel
          └─ POST /api/projects/:id/tickets { agent: value | undefined }
```

### Ticket Detail

```
Ticket Detail Modal
  └─ Reads ticket.agent + ticket.project.defaultAgent
      └─ <AgentBadge> shows effective agent (with inherited indicator)
      └─ "Edit Agent" button (INBOX only)
          └─ <AgentEditDialog>
              └─ PATCH /api/projects/:id/tickets/:id { agent, version }
```

### Ticket Card (Board)

```
Ticket Card
  └─ Reads ticket.agent + ticket.project.defaultAgent
      └─ <Badge> shows effective agent label
          └─ Inherited: muted styling + "(default)"
          └─ Explicit: normal styling
```

### Quick-Impl Modal

```
Quick-Impl Modal
  └─ Receives project.defaultAgent
      └─ <Select> for agent choice
          └─ onConfirm(selectedAgent)
              └─ Transition API includes agent
```
