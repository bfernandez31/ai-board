# API Contracts: Workflow Dispatch Agent Parameter

**Branch**: `AIB-230-pass-agent-selection` | **Date**: 2026-03-05

## Utility Function

### `resolveEffectiveAgent(ticket: TicketWithProject): Agent`

**Location**: `lib/workflows/transition.ts`

```typescript
import { Agent, Ticket, Project } from '@prisma/client';

type TicketWithProject = Ticket & { project: Project };

function resolveEffectiveAgent(ticket: TicketWithProject): Agent {
  return ticket.agent ?? ticket.project.defaultAgent ?? Agent.CLAUDE;
}
```

**Returns**: Always returns a valid `Agent` enum value (never null/undefined).

---

## Workflow Dispatch Contracts

### 1. speckit.yml — specifyPayload JSON

**Input**: `specifyPayload` (string, JSON-encoded)

```json
{
  "ticketKey": "AIB-230",
  "title": "Feature title",
  "description": "Feature description",
  "clarificationPolicy": "AUTO",
  "agent": "CLAUDE"
}
```

**Changes**: Added `agent` field to existing JSON payload. No new workflow input.

### 2. quick-impl.yml — quickImplPayload JSON

**Input**: `quickImplPayload` (string, JSON-encoded)

```json
{
  "ticketKey": "AIB-230",
  "title": "Feature title",
  "description": "Feature description",
  "agent": "CODEX"
}
```

**Changes**: Added `agent` field to existing JSON payload. No new workflow input.

### 3. verify.yml — Discrete Input

**New Input**:
```yaml
agent:
  description: 'Agent CLI to use (CLAUDE or CODEX)'
  required: true
  type: string
```

### 4. cleanup.yml — Discrete Input

**New Input**:
```yaml
agent:
  description: 'Agent CLI to use (CLAUDE or CODEX)'
  required: true
  type: string
```

### 5. ai-board-assist.yml — Discrete Input

**New Input**:
```yaml
agent:
  description: 'Agent CLI to use (CLAUDE or CODEX)'
  required: true
  type: string
```

### 6. iterate.yml — Discrete Input

**New Input**:
```yaml
agent:
  description: 'Agent CLI to use (CLAUDE or CODEX)'
  required: true
  type: string
```

---

## Dispatch Helper Interface Changes

### `AIBoardWorkflowInputs` (dispatch-ai-board.ts)

```typescript
export interface AIBoardWorkflowInputs {
  ticket_id: string;
  stage: string;
  branch: string;
  user_id: string;
  user: string;
  comment: string;
  job_id: string;
  project_id: string;
  githubRepository: string;
  agent: string;  // NEW
}
```

### Cleanup Route (clean/route.ts)

```typescript
// In dispatch inputs object:
inputs: {
  ticket_id: result.ticket.ticketKey,
  project_id: projectId.toString(),
  job_id: result.job.id.toString(),
  githubRepository: targetRepository,
  agent: effectiveAgent,  // NEW
}
```

---

## Workflow-to-Workflow Propagation

### verify.yml → iterate.yml

When verify.yml dispatches iterate.yml (via `gh workflow run`), it must forward the `agent` input:

```bash
gh workflow run iterate.yml \
  --field ticket_id="${{ inputs.ticket_id }}" \
  --field job_id="$NEW_JOB_ID" \
  --field project_id="${{ inputs.project_id }}" \
  --field branch="${{ inputs.branch }}" \
  --field issues_to_fix="$ISSUES_JSON" \
  --field githubRepository="${{ inputs.githubRepository }}" \
  --field agent="${{ inputs.agent }}"
```
