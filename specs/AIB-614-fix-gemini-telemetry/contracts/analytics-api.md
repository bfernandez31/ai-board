# Contract: Analytics API — Dynamic Agent Filter

## Endpoint

`GET /api/projects/:projectId/analytics`

## Agent Filter Changes

### Current (Hardcoded)

```typescript
agent: z.enum(['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']).default('all')
```

### Target (Dynamic)

```typescript
// Validation accepts any value from Prisma Agent enum + 'all'
agent: z.enum(['all', ...Object.values(Agent)]).default('all')
```

### Response — `availableAgents`

The `availableAgents` array in the response already contains only agents with job data. No changes to the response contract. The change is purely in how agent values are validated and enumerated on the server side.

```json
{
  "availableAgents": [
    { "value": "all", "label": "All agents", "jobCount": 42, "isDefault": true },
    { "value": "CLAUDE", "label": "Claude", "jobCount": 30, "isDefault": false },
    { "value": "GEMINI", "label": "Gemini", "jobCount": 12, "isDefault": false }
  ]
}
```

## Token Breakdown Extension

### Current

```json
{
  "tokenUsage": {
    "inputTokens": 150000,
    "outputTokens": 45000,
    "cacheTokens": 80000
  }
}
```

### Target (if thinking tokens are surfaced in analytics)

```json
{
  "tokenUsage": {
    "inputTokens": 150000,
    "outputTokens": 45000,
    "thinkingTokens": 12000,
    "cacheTokens": 80000
  }
}
```

**Note**: `thinkingTokens` is additive. Existing consumers that do not read the field are unaffected.
