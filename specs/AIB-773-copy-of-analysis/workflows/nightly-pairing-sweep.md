# Internal Process: Nightly Pairing Sweep

**Branch**: `AIB-773-copy-of-analysis`

## Overview

A scheduled GitHub Actions workflow runs nightly and triggers the maintenance API endpoint that retries pairings whose outcome arrived late, and expires pairings whose outcome never arrived within 24 hours of SHIP.

## Trigger

```yaml
name: Nightly Pairing Sweep

on:
  schedule:
    - cron: '45 1 * * *'   # 01:45 UTC, offset from log-prune (01:15) and health (00:30)
  workflow_dispatch: {}

jobs:
  sweep-pairings:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Trigger pairing sweep
        env:
          APP_URL: ${{ vars.APP_URL }}
          WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
        run: |
          set -euo pipefail
          response=$(curl -sS -w "\n%{http_code}" \
            -X POST "$APP_URL/api/maintenance/sweep-unpaired-pairings" \
            -H "Authorization: Bearer $WORKFLOW_API_TOKEN")
          body=$(echo "$response" | head -n -1)
          code=$(echo "$response" | tail -n 1)
          echo "HTTP $code"
          echo "$body"
          [ "$code" = "200" ]
```

File: `.github/workflows/nightly-pairing-sweep.yml` (NEW)

## Inputs

None. The endpoint is parameterless; `WINDOW_HOURS=24` is a server-side constant.

## Phases

### Phase 1 — Find pending pairings

```sql
SELECT id, ticketId, shippedAt FROM AnalysisOutcomePairing
WHERE pendingOutcome = true AND unpairedReason IS NULL
ORDER BY shippedAt ASC
LIMIT 1000
```

The 1000 cap bounds a single sweep; if more remain they are picked up the next night (acceptable lag for a 24h window).

### Phase 2 — Find tickets-without-row that should have rows

Some SHIP transitions may have run before this feature shipped, or pairing crashed before any row was inserted. Find:

```sql
SELECT t.id AS ticketId, t.shippedAt FROM Ticket t
JOIN TicketAnalysis a ON a.ticketId = t.id AND a.status = 'success'
LEFT JOIN AnalysisOutcomePairing p ON p.ticketId = t.id
WHERE t.stage = 'SHIP'
  AND p.id IS NULL
  AND t.updatedAt > NOW() - INTERVAL '7 days'   -- bound the catch-up window
LIMIT 500
```

The 7-day floor stops the sweep from chewing through unbounded historical data on first deploy.

### Phase 3 — For each candidate, retry pairing

```typescript
for (const { ticketId, shippedAt } of candidates) {
  const ageMs = Date.now() - shippedAt.getTime();
  if (ageMs > 24 * 60 * 60 * 1000) {
    // Expire: outcome never arrived within window
    await prisma.analysisOutcomePairing.upsert({
      where: { ticketId },
      create: {
        ticketId, projectId, analysisId: /* lookup */,
        shippedAt,
        pendingOutcome: false, unpairedReason: 'outcome_missing_24h',
        // … incomparable defaults …
      },
      update: { pendingOutcome: false, unpairedReason: 'outcome_missing_24h' },
    });
    counters.expired += 1;
  } else {
    // Within window — attempt full pairing
    const result = await pairAnalysisWithOutcome(ticketId);
    if (result.paired) counters.pairedNow += 1;
  }
}
```

### Phase 4 — Return counters

Endpoint returns `{ examinedPending, pairedNow, expired, windowHours: 24 }`.

## Output

- 0..N rows transitioned from `pendingOutcome=true` → `unpairedReason='outcome_missing_24h'`.
- 0..N rows successfully paired (outcome arrived after SHIP but before 24h cap).
- Logs lines with `[drift-sweep]` tag for observability.

## Error Behaviour

- A single ticket failing during pairing logs and continues to the next ticket; the sweep does not abort on per-ticket errors.
- A DB-level error (connection lost, timeout) returns 500 from the endpoint, which the workflow surfaces via the curl assertion `[ "$code" = "200" ]`. GitHub Actions emails project maintainers on workflow failure (existing notification path).
- The sweep is idempotent: running it twice in the same night is safe (upsert; expired rows stay expired).

## Manual Override

The endpoint also responds to `workflow_dispatch` triggers (manual run from GitHub UI). No additional auth path — same Bearer token from secrets.
