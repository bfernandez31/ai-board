# Data Model: Add Telemetry Metrics to Ticket Comparison

## Entities

This feature uses **existing entities only** - no new database tables or schema changes required.

### Existing Entities (Read-Only Access)

#### Job (Prisma Model)

Telemetry data is already stored in the `Job` model:

```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)
  status      JobStatus @default(PENDING)
  ...

  // Claude telemetry metrics (aggregated from all API calls in the job)
  inputTokens        Int?     // Total input tokens consumed
  outputTokens       Int?     // Total output tokens generated
  cacheReadTokens    Int?     // Total cache read tokens
  cacheCreationTokens Int?    // Total cache creation tokens
  costUsd            Float?   // Total cost in USD
  durationMs         Int?     // Total Claude API duration in milliseconds
  model              String?  @db.VarChar(50) // Primary model used
  toolsUsed          String[] @default([])    // List of tools used
}
```

#### Ticket (Prisma Model)

Used for ticket key resolution:

```prisma
model Ticket {
  id          Int       @id @default(autoincrement())
  ticketKey   String    @db.VarChar(20)  // e.g., "AIB-123"
  projectId   Int
  ...
}
```

### Runtime Artifacts (Not Persisted)

#### TelemetryContextFile

JSON file written by workflow, read by compare command. Not stored in database.

**Location**: `specs/$BRANCH/.telemetry-context.json`

**Schema**:
```typescript
interface TelemetryContextFile {
  /** ISO timestamp of generation */
  generatedAt: string;

  /** Telemetry data keyed by ticket key */
  tickets: Record<string, TicketTelemetry>;
}
```

## Existing TypeScript Types

### TicketTelemetry (lib/types/comparison.ts)

Already defined, no changes needed:

```typescript
interface TicketTelemetry {
  ticketKey: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
  model: string | null;
  toolsUsed: string[];
  jobCount: number;
  hasData: boolean;
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ai-board-assist.yml Workflow                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Parse /compare command → Extract ticket keys (e.g., AIB-127, AIB-128)│
│                                                                         │
│  2. For each ticket key:                                                │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │ GET /api/projects/{projectId}/tickets/search?q={ticketKey}  │    │
│     │ → Returns: { id: 123, ticketKey: "AIB-127", ... }           │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                             ↓                                           │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │ GET /api/projects/{projectId}/tickets/{ticketId}/jobs       │    │
│     │ → Returns: [{ inputTokens, outputTokens, costUsd, ... }]    │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                             ↓                                           │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │ Aggregate via jq (sum tokens, cost, duration)               │    │
│     │ → Output: TicketTelemetry JSON                              │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  3. Write combined telemetry to specs/$BRANCH/.telemetry-context.json   │
│                                                                         │
│  4. Execute Claude /compare command                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Claude /compare Command                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Read specs/$BRANCH/.telemetry-context.json                          │
│                                                                         │
│  2. Parse JSON → Record<string, TicketTelemetry>                        │
│                                                                         │
│  3. Include in Metrics Comparison table:                                │
│     | Ticket  | Lines | Files | Tests | Cost    | Duration |           │
│     | AIB-127 | 150   | 5     | 3     | $0.1234 | 45s      |           │
│     | AIB-128 | N/A   | N/A   | N/A   | N/A     | N/A      |           │
│                                                                         │
│  4. Use in Efficiency criterion (10% weight) calculation                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Validation Rules

### Ticket Reference Parsing

- Pattern: `/#([A-Z0-9]{3,6}-\d+)/g`
- Maximum: 5 tickets per comparison (excluding source)
- Constraint: All tickets must be in same project

### Job Filtering

- Only `COMPLETED` status jobs are included in aggregation
- Jobs with null telemetry fields contribute 0 to sums

### Telemetry Aggregation

- Sum: inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs
- Union: toolsUsed (unique set)
- Mode: model (most frequently used)
- Count: jobCount (total jobs aggregated)
- Flag: hasData (true if any non-zero values)

## State Transitions

This feature does not introduce new states. The context file is:
- **Created**: When workflow detects `/compare` command
- **Read**: When Claude executes `/compare`
- **Deleted**: Not persisted (workflow artifacts are temporary)
