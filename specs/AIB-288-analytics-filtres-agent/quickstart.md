# Quickstart: Analytics Filters by Agent and Status

## Prerequisites

- Install dependencies with `bun install`
- Ensure `DATABASE_URL` points to a local PostgreSQL instance
- Seed or create a project with:
  - at least one shipped ticket
  - at least one closed ticket
  - jobs attributed to both `CLAUDE` and `CODEX` across project tickets

## Run the app

```bash
TEST_MODE=true bun run dev
```

Open `/projects/{projectId}/analytics`.

## Verify the feature manually

1. Load analytics with no extra query params:
   `/projects/{projectId}/analytics`
2. Confirm the default view shows:
   - status scope `shipped`
   - agent scope `all`
   - shipped and closed summary cards using the same period label
3. Change status to `closed` and confirm all charts and summaries refresh together:
   `/projects/{projectId}/analytics?range=30d&statusScope=closed&agentScope=all`
4. Change status to `shipped+closed` and confirm combined totals are reflected everywhere:
   `/projects/{projectId}/analytics?range=30d&statusScope=shipped+closed&agentScope=all`
5. Change agent to `CLAUDE` or `CODEX` and confirm all metrics scope to that agent only while the selector still lists both agents.
6. Switch between `7d`, `30d`, `90d`, and `all` and confirm both summary-card labels and counts update for each period.
7. Select an agent with no activity in the active period and confirm zero states appear without removing the agent from the selector:
   `/projects/{projectId}/analytics?range=7d&statusScope=shipped&agentScope=CODEX`

## Suggested test commands

```bash
bun run test:unit
bun run test:integration
```

## Expected implementation touchpoints

- `app/api/projects/[projectId]/analytics/route.ts`
- `app/projects/[projectId]/analytics/page.tsx`
- `components/analytics/analytics-dashboard.tsx`
- `components/analytics/overview-cards.tsx`
- `lib/analytics/queries.ts`
- `lib/analytics/types.ts`
- `app/lib/query-keys.ts`
