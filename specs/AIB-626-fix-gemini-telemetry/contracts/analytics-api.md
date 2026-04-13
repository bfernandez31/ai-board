# Contract: Analytics Agent Filters and Gemini Metrics

## Endpoint Extended

### `GET /api/projects/:projectId/analytics`

## Query parameters

- `range`: `7d | 30d | 90d | all`
- `outcome`: `shipped | closed | all-completed`
- `agent`: `all | CLAUDE | CODEX | MISTRAL | GEMINI`

## Response changes

### `availableAgents`

- Must be built from the authoritative supported-agent source plus real project job history.
- Must include:
  - `{ value: "all", label: "All agents", ... }`
  - Gemini when Gemini-backed job history exists
  - Other supported agents when their history exists

### Gemini analytics expectations

- Gemini jobs contribute to:
  - overview totals
  - token-usage charts
  - top-tools charts
  - cost charts when pricing is available
- Historical Gemini jobs with incomplete telemetry remain visible but may leave some chart categories empty.

### Cost availability semantics

- `overview.costsIncomplete` must remain `true` when filtered Gemini jobs include unsupported models with unavailable pricing.
- Missing Gemini pricing must not remove those jobs from token or tool aggregates.
