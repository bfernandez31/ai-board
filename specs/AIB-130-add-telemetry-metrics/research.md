# Phase 0: Research - Add Telemetry Metrics to Ticket Comparison

## Research Tasks

### 1. Telemetry Data Access Pattern

**Decision**: Use existing Jobs API with workflow token authentication

**Rationale**:
- The `/api/projects/[projectId]/tickets/[id]/jobs` endpoint already returns full telemetry data (inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs, model, toolsUsed)
- Workflow already has `WORKFLOW_API_TOKEN` available via secrets
- No new endpoints needed

**Alternatives Considered**:
1. **Direct database query from workflow**: Rejected - requires DB connection string exposure, security risk
2. **New dedicated telemetry endpoint**: Rejected - duplication of existing jobs endpoint functionality
3. **GraphQL endpoint**: Rejected - overkill for simple aggregation, not used elsewhere in codebase

### 2. Ticket Key to Ticket ID Resolution

**Decision**: Use search API then jobs API for each ticket

**Rationale**:
- The `/api/projects/[projectId]/tickets/search?q=AIB-123` endpoint finds tickets by key
- Returns ticket `id` which is needed to fetch jobs
- Already authenticated with workflow token

**Alternatives Considered**:
1. **New endpoint for ticketKey-based lookup**: Rejected - search API already provides this
2. **Batch endpoint for multiple tickets**: Considered for future optimization, but initial implementation uses sequential calls

### 3. Context File Format and Location

**Decision**: Write `.telemetry-context.json` to `specs/$BRANCH/` directory

**Rationale**:
- Matches existing pattern for workflow artifacts (`.ai-board-result.md`)
- Spec directory is branch-specific, avoiding cross-branch conflicts
- JSON format matches `TicketTelemetry` interface exactly
- Claude can read JSON files natively

**File Structure**:
```json
{
  "generatedAt": "2026-01-03T14:30:00Z",
  "tickets": {
    "AIB-127": {
      "ticketKey": "AIB-127",
      "inputTokens": 50000,
      "outputTokens": 25000,
      "cacheReadTokens": 10000,
      "cacheCreationTokens": 5000,
      "costUsd": 0.1234,
      "durationMs": 45000,
      "model": "claude-sonnet-4-5-20251101",
      "toolsUsed": ["Edit", "Write", "Bash"],
      "jobCount": 3,
      "hasData": true
    },
    "AIB-128": {
      "ticketKey": "AIB-128",
      "hasData": false
    }
  }
}
```

**Alternatives Considered**:
1. **Environment variable**: Rejected - too large, character limits
2. **Separate file per ticket**: Rejected - unnecessary complexity
3. **YAML format**: Rejected - JSON is simpler, native to jq

### 4. Workflow Integration Point

**Decision**: Add telemetry fetch step before Claude command execution, conditional on `/compare` command

**Rationale**:
- Only `/compare` commands need telemetry context
- Fetching before Claude ensures data is available when command runs
- Other commands (assistance, clarification) don't need telemetry overhead

**Implementation Pattern**:
```yaml
- name: Fetch Telemetry for Compare
  if: ${{ env.SKIP_CLAUDE != 'true' && contains(inputs.comment, '/compare') }}
  run: |
    # Parse ticket references from comment
    # Fetch telemetry for each via API
    # Write .telemetry-context.json
```

**Alternatives Considered**:
1. **Always fetch telemetry**: Rejected - unnecessary overhead for non-compare commands
2. **Claude fetches via MCP/tool**: Rejected - Claude cannot make authenticated API calls
3. **Pre-compute and store telemetry**: Rejected - adds staleness, storage overhead

### 5. Error Handling Strategy

**Decision**: Graceful degradation with empty telemetry for failures

**Rationale**:
- Comparison should not fail if telemetry is unavailable
- Use `createEmptyTelemetry()` from existing `lib/comparison/telemetry-extractor.ts`
- Log warnings but continue execution

**Error Scenarios**:
| Scenario | Handling |
|----------|----------|
| Ticket not found | Log warning, use empty telemetry |
| Jobs API error | Log warning, use empty telemetry |
| No completed jobs | Return empty telemetry (hasData: false) |
| Network timeout | Retry once, then use empty telemetry |

**Alternatives Considered**:
1. **Fail comparison on any error**: Rejected - too fragile
2. **Partial telemetry with warnings**: Accepted - implemented via `hasData` flag

### 6. Existing Telemetry Infrastructure

**Decision**: Reuse existing `lib/comparison/telemetry-extractor.ts` utilities

**Rationale**:
- `aggregateJobTelemetry()` already implements job aggregation logic
- `createEmptyTelemetry()` provides consistent empty state
- `formatTelemetryDisplay()` handles N/A formatting
- `compareTelemetry()` computes cost/token differences

**Key Functions to Leverage**:
- `aggregateJobTelemetry(ticketKey, jobs)` - Aggregates job data into TicketTelemetry
- `createEmptyTelemetry(ticketKey)` - Creates empty telemetry for missing data
- `formatTelemetryDisplay(telemetry)` - Formats for display with N/A handling

## Resolved Clarifications

All technical context unknowns from plan.md have been resolved through this research:

| Unknown | Resolution |
|---------|------------|
| API authentication | Use existing `WORKFLOW_API_TOKEN` |
| Ticket key resolution | Use search API then jobs API |
| Context file location | `specs/$BRANCH/.telemetry-context.json` |
| Error handling | Graceful degradation with empty telemetry |
| Telemetry aggregation | Reuse existing `telemetry-extractor.ts` |

## Dependencies Identified

1. **Existing Code** (no changes needed):
   - `lib/types/comparison.ts` - TicketTelemetry interface
   - `lib/comparison/telemetry-extractor.ts` - Aggregation utilities
   - `/api/projects/[projectId]/tickets/[id]/jobs` - Jobs API
   - `/api/projects/[projectId]/tickets/search` - Search API

2. **Workflow Tools** (available in GitHub Actions):
   - `curl` - HTTP requests
   - `jq` - JSON processing
   - `bash` - Scripting

3. **Secrets** (already configured):
   - `WORKFLOW_API_TOKEN` - API authentication
   - `APP_URL` - API base URL
