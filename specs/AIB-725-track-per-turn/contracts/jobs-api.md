# Contract: Jobs API — Context Telemetry Fields

**Endpoint**: `GET /api/projects/:projectId/tickets/:id/jobs`
**Source**: `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` (extended)

## Response (existing + new)

```ts
interface TicketJobWithTelemetry {
  id: number;
  command: string;
  status: string;
  branch: string | null;
  startedAt: Date | string;
  completedAt: Date | string | null;

  // Existing aggregated telemetry
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];

  // New — AIB-725
  peakContextTokens: number | null;   // peak per-turn context size
  avgContextTokens:  number | null;   // mean per-turn context size
  turnCount:         number | null;   // number of parsed turns

  qualityScore: number | null;
  qualityScoreDetails: string | null;
  log: TicketJobLogSummary | null;
}
```

## Field semantics

- `peakContextTokens`, `avgContextTokens`, `turnCount`: all `null` for:
  - Jobs run with agents that expose no per-turn telemetry (Mistral today).
  - Jobs whose OTLP stream produced zero successfully-parsed per-turn events.
  - Historical jobs that predate this feature (no backfill).
- For Gemini jobs, `peakContextTokens` MAY populate while `avgContextTokens` and `turnCount` remain `null` (Gemini emits cumulative snapshots, not deltas — see research.md D-001).
- All three values are in tokens (integer). Computation rules: research.md D-001.

## Back-compat

- No removed or renamed fields.
- Existing consumers (`JobsTimeline` component, ticket stats tab) read the existing fields unchanged; the new fields are additive and optional in practice.
- FR-013: existing `inputTokens`/`outputTokens`/`costUsd`/`durationMs` behavior is identical.

## Authorization

Unchanged. Dual auth (workflow bearer token OR project session access) — same helper chain as today.

---

# Contract: Jobs Status Polling (unchanged)

**Endpoint**: `GET /api/projects/:projectId/jobs/status`

**Deliberately unchanged.** Per research.md, the short-poll endpoint stays lean: `{id, status, ticketId, command, updatedAt}`. FR-015 is satisfied because the detailed `GET /api/projects/:projectId/tickets/:id/jobs` endpoint (above) already exposes the telemetry to SSR + client refetches.
