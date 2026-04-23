# Job Log Retrieval and Presentation

## Purpose

Expose captured job logs through the existing ticket inspection experience without replacing current telemetry or overwhelming the default timeline view.

## Read Paths

### Timeline preview

- Route: `GET /api/projects/{projectId}/tickets/{ticketId}/timeline`
- Returns job lifecycle events enriched with:
  - `logAvailability`
  - `logSummary`
  - `logCapturedAt`
  - `logRetainedUntil`
  - `logPrunedAt`

### Ticket job list

- Route: `GET /api/projects/{projectId}/tickets/{ticketId}/jobs`
- Returns each job with telemetry plus the same summary metadata fields used by the jobs timeline in the stats surface.

### Full detail

- Route: `GET /api/projects/{projectId}/jobs/{jobId}/logs`
- Returns summary plus retained `events[]` when available.

## Access Rules

1. Member or owner access must match the ticket/project authorization rules already used elsewhere in the app.
2. Workflow token auth is never accepted for member-facing reads.
3. Requests for a job outside the requested project must return `403` or `404`, not cross-project data.

## UI Contract

### Timeline job item

- Show current lifecycle message as today.
- If `logSummary` exists, show:
  - the summary headline
  - the last few important events
  - partial/unavailable/pruned messaging
  - a `View full logs` action when retained detail exists

### Jobs timeline row

- Keep duration, cost, model, cancel behavior, and telemetry details intact.
- Add preview summary below or beside existing telemetry.
- Show `View full logs` for `AVAILABLE` and `PARTIAL` detail when events remain.

### Full-log dialog

- Hosted from `components/board/ticket-detail-modal.tsx`
- Fetch-on-open via a dedicated query key
- Render normalized events in execution order
- Preserve provider-specific detail in expandable or inline metadata blocks when needed

## Error Behavior

| State | UI treatment |
|-------|--------------|
| `UNAVAILABLE` | Show clear capture-failed message; no detail fetch CTA |
| `PARTIAL` | Show warning banner and the events that survived |
| `PRUNED` | Show summary plus explicit retention/pruned notice |
| Missing artifact | Do not imply success; render "Logs unavailable" |

