# Data Model — AIB-775

This feature does **not** introduce a new entity. It extends the existing `Job` entity with two optional version fields. There are no new relationships, no new enums, and no migration of existing rows.

## Entity changes

### `Job` (existing — `prisma/schema.prisma:29-75`)

Two new columns, both optional and immutable once written.

| Field | Type | Constraints | Default | Purpose |
|---|---|---|---|---|
| `pluginVersion` | `String?` | `@db.VarChar(100)` | `null` | The AI-Board plugin's release identifier, captured at job start. Either a semver like `"1.0.1"` (read from `.claude-plugin/plugin.json`) or, when the file is absent or unparseable, a short SHA prefixed with `"sha:"` (e.g. `"sha:7bf6d3a4"`). |
| `agentCliVersion` | `String?` | `@db.VarChar(100)` | `null` | The version string the agent CLI reports for itself, captured at job start. The first non-empty line of `<cli> --version`, trimmed (e.g. `"claude-code 0.5.12"`, `"codex 0.20.0"`, `"gemini 0.3.1"`, `"vibe 0.4.0"`). Stored verbatim — no parsing. |

#### Validation

- **Length**: `1 ≤ length ≤ 100` (Zod), aligned 1:1 with `@db.VarChar(100)` per constitution §IV. Values are trimmed before insert; an empty post-trim string is rejected as invalid input rather than written as empty.
- **Nullability**: both columns are nullable to support (a) jobs created before this feature ships, and (b) the partial-capture case where one of the two values fails to be probed (FR-004).
- **No format validation**: per spec edge-case "Format de version reportée par un CLI inconnu / non parsable" — store the raw string; no regex, no parsed semver structure.

#### Immutability (FR-009)

Both columns are written exactly once per job. The new endpoint enforces first-write-wins:

```ts
const updateData: { pluginVersion?: string; agentCliVersion?: string } = {};
if (body.pluginVersion && !job.pluginVersion) updateData.pluginVersion = body.pluginVersion;
if (body.agentCliVersion && !job.agentCliVersion) updateData.agentCliVersion = body.agentCliVersion;
```

This is the same pattern used for `Job.workflowRunId` at `app/api/jobs/[id]/status/route.ts:204-206`. Subsequent calls with the same `jobId` are no-ops on already-set columns; this makes the runner's POST safely retryable.

#### Indexing

No new index is added. The two columns are read-only in the same `select` statements that already produce the job detail panel payload, and they are never used as filter, sort, or `where` clauses. Adding indexes would be premature optimization (constitution: don't design for hypothetical future requirements).

## State transitions (informational — not tracked in DB)

```
                      ┌─────────────────────────────────────────────────┐
Job created (PENDING) │  pluginVersion = null, agentCliVersion = null   │
                      └────────────────────────┬────────────────────────┘
                                               │
                       Workflow PATCH /status RUNNING (existing)
                                               │
                       Workflow POST /versions (NEW, this feature)
                                               ▼
                      ┌─────────────────────────────────────────────────┐
Job has versions      │  pluginVersion ∈ {string, null}                 │
                      │  agentCliVersion ∈ {string, null}               │
                      │  immutable for the rest of the job's lifetime   │
                      └─────────────────────────────────────────────────┘
                                               │
                                               ▼
                                Job terminal (COMPLETED/FAILED/CANCELLED)
                                versions unchanged
```

The two columns transition independently: it is valid to have one set and the other still `null` (FR-004; spec scenario US-2 #3). The transition table for a single column is simply `null → string` (one-way, irreversible).

## TypeScript surface (`lib/types/job-types.ts`)

The shared `TicketJobWithTelemetry` interface is the bridge between the API GET payload and the React tree (`TicketStats` → `JobsTimeline` → `JobRow`). Two new fields are appended to the existing shape:

```ts
export interface TicketJobWithTelemetry {
  // … existing fields unchanged …
  pluginVersion: string | null;
  agentCliVersion: string | null;
}
```

The mirror Prisma model auto-generates the same nullable columns onto `@prisma/client`'s `Job` type, so the existing `DualJobState` interface (which references `import type { Job }`) picks up the new fields with no edit required.

## What this model does NOT introduce

- **No new table** (`JobVersion`, `JobCapture`, etc.). Two columns on `Job` are sufficient.
- **No enum**. The values are open strings; an enum would close the version space.
- **No FK/relation**. There is no second entity to relate to.
- **No timestamp** (`pluginVersionCapturedAt` etc.). The existing `startedAt` is the canonical "this is when the job started; the versions were captured around then" — a separate timestamp would only be useful for forensic ordering between capture and the RUNNING PATCH, which the spec doesn't require.
- **No backfill column / flag**. Pre-feature jobs are simply `null`; the UI placeholder is the only signal needed.
