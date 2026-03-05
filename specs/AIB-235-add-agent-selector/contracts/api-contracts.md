# API Contracts: Add Agent Selector UI

**Date**: 2026-03-04 | **Feature**: AIB-235

## Overview

No new API endpoints are needed. All endpoints already support agent fields (from AIB-228). This document describes the existing contracts that the UI will consume.

## Existing Endpoints (UI Integration Points)

### 1. Update Project Default Agent

```
PATCH /api/projects/:projectId
```

**Request Body** (partial — only agent-related field shown):
```json
{
  "defaultAgent": "CLAUDE" | "CODEX"
}
```

**Response** (200):
```json
{
  "id": 1,
  "defaultAgent": "CODEX",
  ...
}
```

**Authorization**: Project owner or member (settings page access-controlled).

---

### 2. Create Ticket with Agent

```
POST /api/projects/:projectId/tickets
```

**Request Body** (partial — only agent-related field shown):
```json
{
  "title": "...",
  "description": "...",
  "agent": "CLAUDE" | "CODEX" | null
}
```

- `agent: null` or omitted = inherit from project default
- `agent: "CODEX"` = explicit override

**Response** (201):
```json
{
  "id": 1,
  "agent": null,
  "project": {
    "defaultAgent": "CLAUDE"
  },
  ...
}
```

---

### 3. Update Ticket Agent

```
PATCH /api/projects/:projectId/tickets/:ticketId
```

**Request Body**:
```json
{
  "agent": "CODEX" | "CLAUDE" | null,
  "version": 3
}
```

**Constraints**: Agent can only be changed when ticket is in INBOX stage. Returns 400 if ticket is in any other stage.

**Response** (200):
```json
{
  "id": 1,
  "agent": "CODEX",
  "version": 4,
  ...
}
```

---

### 4. Get Ticket (includes agent data)

```
GET /api/projects/:projectId/tickets/:ticketId
```

**Response** (200):
```json
{
  "id": 1,
  "agent": null,
  "project": {
    "defaultAgent": "CLAUDE"
  },
  ...
}
```

## UI Component Contracts

### Agent Utility Functions (`app/lib/utils/agent-icons.ts`)

```typescript
import { Agent } from '@prisma/client';

function getAgentIcon(agent: Agent): string;
// CLAUDE → '🤖', CODEX → '⚡'

function getAgentLabel(agent: Agent): string;
// CLAUDE → 'Claude', CODEX → 'Codex'

function getAgentDescription(agent: Agent): string;
// CLAUDE → 'Anthropic Claude Code', CODEX → 'OpenAI Codex'
```

### DefaultAgentCard Props

```typescript
interface DefaultAgentCardProps {
  project: {
    id: number;
    defaultAgent: Agent;
  };
}
```

### AgentEditDialog Props

```typescript
interface AgentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAgent: Agent | null;
  projectDefaultAgent: Agent;
  onSave: (agent: Agent | null) => Promise<void>;
  isSaving: boolean;
}
```

### QuickImplModal Extended Props

```typescript
interface QuickImplModalProps {
  open: boolean;
  onConfirm: (agent?: Agent) => void;
  onCancel: () => void;
  defaultAgent: Agent;
}
```
