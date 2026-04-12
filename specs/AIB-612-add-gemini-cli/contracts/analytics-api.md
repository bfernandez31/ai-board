# Contract: Analytics API for Gemini and Mistral Consistency

## Endpoint Extended

### `GET /api/projects/:projectId/analytics`

### Query parameters

- `range`: unchanged
- `outcome`: unchanged
- `agent`:
  - existing: `all`, `CLAUDE`, `CODEX`
  - add: `MISTRAL`, `GEMINI`

### Filter semantics

- Agent filtering is based on effective agent:
  - `ticket.agent`
  - else `ticket.project.defaultAgent`
- If a requested agent is not available in current project history, the endpoint falls back to `all`

## Response changes

### `filters.agent`

- May now return:
  - `all`
  - `CLAUDE`
  - `CODEX`
  - `MISTRAL`
  - `GEMINI`

### `availableAgents`

Each option remains:

```json
{
  "value": "GEMINI",
  "label": "Gemini",
  "jobCount": 4,
  "isDefault": false
}
```

### Cost semantics

- Gemini jobs participate in totals when pricing metadata exists
- If Gemini metrics exist but cost is unavailable:
  - token, tool, duration, and job counts still contribute normally
  - total-cost calculations exclude unavailable-cost jobs rather than forcing `0`
  - UI should surface that cost totals may be incomplete

## Behavioral guarantees

- Mistral appears anywhere agent-based analytics filtering already exists
- Gemini appears when Gemini jobs exist in the filtered project history
- Mixed-agent datasets preserve current Claude and Codex behavior

