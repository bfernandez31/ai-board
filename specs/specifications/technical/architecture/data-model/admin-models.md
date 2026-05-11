# Admin Models

## InsightsRun

Represents a single execution of the Claude Code `/insights` analysis over captured agent session artifacts. Triggered manually from the admin Insights page; runs are global (not project-scoped) and operate cross-project on shipped CLAUDE-agent tickets.

```prisma
model InsightsRun {
  id           Int               @id @default(autoincrement())
  status       InsightsRunStatus @default(PENDING)
  triggeredBy  String
  periodStart  DateTime?
  periodEnd    DateTime?
  sessionCount Int?
  ticketCount  Int?
  reportKey    String?           @db.VarChar(300)
  reportSize   Int?
  errorMessage String?           @db.VarChar(2000)
  timeoutAt    DateTime
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  user User @relation(fields: [triggeredBy], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
  @@index([createdAt(sort: Desc)])
  @@index([status])
}
```

**Fields**:
- `id`: Auto-incrementing run identifier
- `status`: Current lifecycle state (`InsightsRunStatus`)
- `triggeredBy`: User ID of the admin who triggered the run (required, cascade delete)
- `periodStart` / `periodEnd`: Window of shipped activity analyzed; populated when the run reaches `COMPLETED`
- `sessionCount`: Number of Claude Code session JSONL artifacts fed into `/insights`
- `ticketCount`: Number of shipped tickets covered by the analysis window
- `reportKey`: Vercel Blob key for the HTML report (`insights-reports/<runId>.html`); null until `COMPLETED`
- `reportSize`: Size of the uploaded HTML report in bytes
- `errorMessage`: Failure description (max 2000 chars); set when transitioning to `FAILED`
- `timeoutAt`: Deadline after which a stuck `PENDING` or `RUNNING` row no longer blocks new triggers (currently 30 minutes after creation)
- `startedAt`: Set when the run transitions to `RUNNING`
- `completedAt`: Set when the run reaches `COMPLETED` or `FAILED`

**Indexes**:
- `(status, createdAt)`: Active run lookup for duplicate-trigger prevention
- `(createdAt DESC)`: Chronological listing of past runs (newest first)
- `(status)`: Status-based filtering for the list endpoint

**Relations**:
- `triggeredBy` → `User.id` (cascade delete)
- `User.insightsRuns` back-reference (`InsightsRun[]`)

**Validation Rules** (enforced at trigger time):
- Caller must satisfy `verifyAdminAccess()` (authenticated and email present on `ADMIN_EMAILS` allowlist)
- No `PENDING` or `RUNNING` row with `timeoutAt > now()` may exist for the entire system
- `BLOB_READ_WRITE_TOKEN` must be configured; otherwise the trigger returns 503
- At least one shipped ticket with the resolved CLAUDE agent must exist with `updatedAt > lastCompletedRun.periodEnd` (or unbounded for the first run)

**State Transitions**: See [InsightsRunStatus](./enums.md#insightsrunstatus).

**Lifecycle Side Effects**:
- On `RUNNING`: `startedAt = now()`
- On `COMPLETED`: `completedAt = now()`, and `periodStart`, `periodEnd`, `sessionCount`, `ticketCount`, `reportKey`, `reportSize` are all required
- On `FAILED`: `completedAt = now()`, `errorMessage` required

## Insights Report Artifact

The HTML report produced by Claude Code's `/insights` command is stored as a Blob artifact, not in the database.

| Aspect | Detail |
|--------|--------|
| Key pattern | `insights-reports/<runId>.html` |
| Content type | `text/html; charset=utf-8` |
| Access | Private — proxied through `GET /api/admin/insights/runs/[runId]/report` with admin auth |
| Immutability | Written once on `COMPLETED`; never overwritten |
| Retention | No automated pruning — reports are small and have long-term trend value |

Upload and stream helpers live in `app/lib/blob/client.ts` (`uploadInsightsReport`, `streamInsightsReport`) and follow the same pattern as job log artifacts. The key builder is `buildInsightsReportKey(runId)` in `app/lib/insights/artifact-key.ts`.

## Environment Variables

| Variable | Format | Required | Description |
|----------|--------|----------|-------------|
| `ADMIN_EMAILS` | Comma-separated emails (case-insensitive, whitespace trimmed) | Yes (for `/admin` to function) | Allowlist of users granted admin access. Fail-closed: empty or missing means no one has access. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | Yes | Shared with job log artifacts; reused for report storage |
