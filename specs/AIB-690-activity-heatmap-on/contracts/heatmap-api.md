# API Contract: GET /api/activity/heatmap

**Feature**: AIB-690 Activity Heatmap
**Route file**: `app/api/activity/heatmap/route.ts` (new)

## Purpose

Return a full heatmap dataset (grid cells, header summary, filter options, bucket thresholds) for the signed-in user's accessible projects, for a given period and optional agent filter. Consumed by both the `/projects` server page (for SSR initial data) and by client-side TanStack Query polling.

## Authentication

- Session cookie (NextAuth) **or** Bearer PAT via `Authorization: Bearer <token>`. Both resolve via `requireAuth(request)` from `lib/db/users.ts`.
- Test user override (`x-test-user-id`) is honored through the same helper for seeded test users.
- Unauthenticated → `401` with `{ error: "Unauthorized" }`.

## Request

### Method

`GET`

### Query parameters

| Param           | Type                                  | Required | Default         | Notes |
|-----------------|---------------------------------------|----------|-----------------|-------|
| `period`        | `"last12months"` \| 4-digit year `YYYY` | no       | `"last12months"` | Invalid year (non-numeric, outside `[accountCreationYear, currentYear]`) is coerced to the default. |
| `agent`         | `"all"` \| `"CLAUDE"` \| `"CODEX"` \| `"MISTRAL"` \| `"GEMINI"` | no | `"all"` | Unknown value is coerced to `"all"`. |

Validated with Zod via `safeParse` on both server and client read paths. Validation failure does NOT return 400 — invalid params are silently coerced per spec edge case "Invalid query params".

### Example

```
GET /api/activity/heatmap?period=2025&agent=CLAUDE
```

## Response

### Status codes

| Code | Meaning | Body shape |
|------|---------|-----------|
| 200  | Success | `HeatmapData` (see below) |
| 401  | Not authenticated | `{ error: "Unauthorized" }` |
| 500  | Unexpected server error | `{ error: "Internal server error" }` |

Note: no 403 is returned because the endpoint is user-scoped, not project-scoped. The data is filtered to the caller's accessible projects automatically.

### Success body — `HeatmapData`

```ts
interface HeatmapData {
  period: {
    kind: "rolling12m" | "year";
    startDate: string;   // "YYYY-MM-DD" UTC inclusive
    endDate: string;     // "YYYY-MM-DD" UTC inclusive
    year?: number;       // present iff kind === "year"
  };
  filters: {
    period: { kind: "rolling12m"; endDate: string } | { kind: "year"; year: number };
    agent: "all" | "CLAUDE" | "CODEX" | "MISTRAL" | "GEMINI";
  };
  cells: Array<{
    date: string;               // "YYYY-MM-DD"
    jobCount: number;           // >= 0
    shipJobCount: number;       // >= 0, <= jobCount
    shippedTicketCount: number; // >= 0, <= shipJobCount
    totalCostUsd: number | null; // null when any contributing job lacks cost
    bucket: 0 | 1 | 2 | 3 | 4;
  }>;
  summary: {
    totalJobs: number;
    distinctShippedTickets: number;
    periodLabel: string;        // "in the last year" | "in 2025"
  };
  thresholds: {
    p25: number;
    p50: number;
    p75: number;
    maxJobCount: number;
  };
  availableAgents: Array<{
    value: "all" | "CLAUDE" | "CODEX" | "MISTRAL" | "GEMINI";
    label: string;
    jobCount: number;
    isDefault: boolean;
  }>;
  availableYears: number[];     // descending; [] when account created in current year
  generatedAt: string;          // ISO timestamp
}
```

### Invariants

- `cells` is sorted strictly ascending by `date`, with exactly one entry per calendar day between `period.startDate` and `period.endDate` (inclusive). The number of cells equals `days(startDate..endDate) + 1`.
- For every cell: `bucket === 0` if and only if `jobCount === 0`.
- `summary.totalJobs === sum(cells[*].jobCount)`.
- `summary.distinctShippedTickets` is the count of DISTINCT ticket ids that have at least one `ship` job completed in the period, after agent filter — NOT the sum of `cells[*].shippedTicketCount` (which would double-count a ticket re-shipped on different days).
- `thresholds.maxJobCount === max(cells[*].jobCount)`; when all cells have `jobCount === 0`, all threshold fields are `0`.
- `availableAgents` always includes `{ value: "all", label: "All agents", jobCount: totalJobs, isDefault: true }` as the first entry. Only agents with `jobCount > 0` are included beyond "all".

## Caching

- No HTTP caching headers; response is user-specific and changes as jobs complete.
- Client side: TanStack Query with `staleTime: 10_000` and `refetchInterval: 15_000` (matches analytics/usage cadence — CLAUDE.md).

## Error Handling

Server-side try/catch matches `app/api/projects/[projectId]/analytics/route.ts`:

```ts
try {
  const userId = await requireAuth(request);
  const filters = filtersSchema.safeParse(Object.fromEntries(searchParams));
  // coerce rather than reject
  const data = await getHeatmapData(userId, filters.success ? filters.data : defaults);
  return NextResponse.json(data);
} catch (error) {
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.error('Heatmap API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

## Server-Side Initial Data Path

`app/projects/page.tsx` calls `getHeatmapData(userId, filtersFromSearchParams)` directly (not via HTTP). Failures are caught there and the page renders `<ActivityHeatmap initialData={null} initialError={{ message: "Couldn't load activity — please refresh" }} />` so that `<ProjectsContainer>` still renders its cards (spec line 200, "error behavior" in Internal Processes).

## Performance Budget

- Target < 300 ms p95 on 10 projects × 2000 jobs/year.
- Single Prisma transaction of 3 queries: projects, jobs, ticket-count. No N+1.
- Payload size ~30 KB for a 365-day response (400 cells × ~75 bytes JSON).

## Test Matrix (contract-level)

Each row becomes at minimum one assertion in `tests/integration/analytics/heatmap-route.test.ts`:

| Case | Expected |
|------|----------|
| No auth → 401 | `{ error: "Unauthorized" }` |
| Default params, user with jobs across 3 projects (owned + member) | cells count = 365 or 366, summary.totalJobs matches seed |
| `period=2025`, user created 2024 | cells.length = 365, period.kind="year", year=2025 |
| `period=1999` (invalid) | coerced to rolling12m |
| `agent=CLAUDE`, user has jobs on CODEX only | cells all have jobCount=0; availableAgents excludes CLAUDE |
| Ticket with explicit `agent=CODEX` on a project whose `defaultAgent=CLAUDE`, filter `agent=CLAUDE` | the CODEX ticket's jobs are excluded |
| Ticket with `agent=null` on project with `defaultAgent=CLAUDE`, filter `agent=CLAUDE` | ticket's jobs are included (effective-agent) |
| Day with 3 jobs: 2 have cost, 1 null | cell.totalCostUsd === null |
| Day with 2 ship jobs on same ticket → `shipJobCount=2`, `shippedTicketCount=1` | summary counts ticket once |
| All-zero activity in period | cells all bucket 0; thresholds all 0; summary totals 0 |
| All non-zero days share the same jobCount | every non-zero cell → bucket 1 (empty-bucket-1 guard) |
| Quantile with skewed distribution (p75=10, one day=100) | outlier gets bucket 4; other days distributed across 1–3 |
