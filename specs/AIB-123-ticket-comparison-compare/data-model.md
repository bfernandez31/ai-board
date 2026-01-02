# Data Model: Ticket Comparison

**Feature**: AIB-123 - Ticket Comparison
**Date**: 2026-01-02

## Entity Overview

This feature introduces read-only comparison of existing entities with no schema changes required. All new data structures are TypeScript interfaces for in-memory processing; comparison reports are stored as markdown files.

---

## Core Entities

### TicketReference

Parsed ticket key reference from comment text.

```typescript
interface TicketReference {
  /** Raw ticket key (e.g., "AIB-124") */
  ticketKey: string;

  /** Start position in source text */
  startIndex: number;

  /** End position in source text */
  endIndex: number;
}
```

**Source**: Extracted from comment content via `/#([A-Z0-9]{3,6}-\d+)/g` regex.

**Validation Rules**:
- Ticket key format: 3-6 uppercase alphanumeric + hyphen + numeric ID
- Must exist in same project as source ticket
- Limit: 1-5 references per comparison (excluding source ticket)

---

### ComparisonTarget

Resolved ticket with metadata for comparison.

```typescript
interface ComparisonTarget {
  /** Ticket database record */
  ticket: {
    id: number;
    ticketKey: string;
    title: string;
    branch: string | null;
    stage: TicketStage;
    workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  };

  /** Resolution status */
  status: 'resolved' | 'branch_missing' | 'merge_analyzed' | 'unavailable';

  /** Commit SHA if resolved via merge */
  mergeCommitSha?: string;

  /** Spec content if available */
  specContent?: string;

  /** Plan content if available */
  planContent?: string;
}
```

**Resolution Strategy**:
1. `resolved`: Branch exists, full analysis available
2. `branch_missing`: Database has ticket, branch deleted, using cached data
3. `merge_analyzed`: Branch merged, analyzed from merge commit
4. `unavailable`: Cannot resolve ticket or data

---

### FeatureAlignmentScore

Calculated similarity between compared tickets.

```typescript
interface FeatureAlignmentScore {
  /** Overall alignment (0-100%) */
  overall: number;

  /** Breakdown by dimension */
  dimensions: {
    /** Functional requirements overlap (40% weight) */
    requirements: number;

    /** User scenario overlap (30% weight) */
    scenarios: number;

    /** Entity/data model overlap (20% weight) */
    entities: number;

    /** Keyword overlap (10% weight) */
    keywords: number;
  };

  /** Whether full comparison is warranted (>= 30%) */
  isAligned: boolean;

  /** Matching requirements (FR-XXX identifiers) */
  matchingRequirements: string[];

  /** Matching entity names */
  matchingEntities: string[];
}
```

**Calculation**:
```
overall = (0.4 * requirements) + (0.3 * scenarios) + (0.2 * entities) + (0.1 * keywords)
isAligned = overall >= 30
```

---

### ConstitutionComplianceScore

Compliance assessment against project constitution.

```typescript
interface ConstitutionComplianceScore {
  /** Overall compliance (0-100%) */
  overall: number;

  /** Total principles evaluated */
  totalPrinciples: number;

  /** Principles passed */
  passedPrinciples: number;

  /** Per-principle assessment */
  principles: ConstitutionPrinciple[];
}

interface ConstitutionPrinciple {
  /** Principle name (e.g., "TypeScript-First Development") */
  name: string;

  /** Section ID (e.g., "I", "II", "III") */
  section: string;

  /** Pass/fail status */
  passed: boolean;

  /** Specific findings or violations */
  notes: string;
}
```

**Evaluated Principles** (from `.specify/memory/constitution.md`):
1. TypeScript-First Development
2. Component-Driven Architecture
3. Test-Driven Development
4. Security-First Design
5. Database Integrity
6. AI-First Development Model

---

### TicketTelemetry

Aggregated job telemetry for a ticket.

```typescript
interface TicketTelemetry {
  /** Ticket identifier */
  ticketKey: string;

  /** Total input tokens across all jobs */
  inputTokens: number;

  /** Total output tokens across all jobs */
  outputTokens: number;

  /** Total cache read tokens */
  cacheReadTokens: number;

  /** Total cache creation tokens */
  cacheCreationTokens: number;

  /** Total cost in USD */
  costUsd: number;

  /** Total duration in milliseconds */
  durationMs: number;

  /** Primary model used */
  model: string | null;

  /** Unique tools used across jobs */
  toolsUsed: string[];

  /** Number of jobs */
  jobCount: number;

  /** Whether telemetry data is available */
  hasData: boolean;
}
```

**Source**: Aggregated from `Job` model via Prisma.

---

### ImplementationMetrics

Code change metrics for a ticket.

```typescript
interface ImplementationMetrics {
  /** Ticket identifier */
  ticketKey: string;

  /** Total lines added */
  linesAdded: number;

  /** Total lines removed */
  linesRemoved: number;

  /** Net lines changed */
  linesChanged: number;

  /** Number of files changed */
  filesChanged: number;

  /** Changed file paths */
  changedFiles: string[];

  /** Test files changed */
  testFilesChanged: number;

  /** Estimated test coverage percentage (if available) */
  testCoverage?: number;

  /** Whether metrics are available */
  hasData: boolean;
}
```

**Source**: Calculated from `git diff` output.

---

### ComparisonReport

Full comparison document structure.

```typescript
interface ComparisonReport {
  /** Report metadata */
  metadata: {
    /** Report generation timestamp */
    generatedAt: Date;

    /** Source ticket where comparison was triggered */
    sourceTicket: string;

    /** Compared ticket keys */
    comparedTickets: string[];

    /** Report file path */
    filePath: string;
  };

  /** Executive summary */
  summary: string;

  /** Feature alignment analysis */
  alignment: FeatureAlignmentScore;

  /** Per-ticket implementation metrics */
  implementation: Record<string, ImplementationMetrics>;

  /** Per-ticket constitution compliance */
  compliance: Record<string, ConstitutionComplianceScore>;

  /** Per-ticket telemetry/cost */
  telemetry: Record<string, TicketTelemetry>;

  /** AI-generated recommendation */
  recommendation: string;

  /** Warnings (e.g., low alignment, missing data) */
  warnings: string[];
}
```

**Storage**: Markdown file at `specs/{branch}/comparisons/{timestamp}-vs-{keys}.md`

---

## Existing Entities (Read-Only)

### Ticket (from Prisma schema)

```typescript
// Relevant fields for comparison
interface Ticket {
  id: number;
  ticketKey: string;      // "AIB-123"
  title: string;
  branch: string | null;  // Git branch name
  stage: TicketStage;
  workflowType: WorkflowType;
  projectId: number;
  jobs: Job[];            // For telemetry aggregation
}
```

### Job (from Prisma schema)

```typescript
// Telemetry fields for cost analysis
interface Job {
  id: number;
  ticketId: number;
  command: string;
  status: JobStatus;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
}
```

---

## Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                     ComparisonReport                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ metadata.sourceTicket ─────────────────┐                  │   │
│  │ metadata.comparedTickets[]             │                  │   │
│  └────────────────────────────────────────│──────────────────┘   │
│                                           │                      │
│  ┌────────────────────────────────────────▼──────────────────┐   │
│  │               ComparisonTarget[]                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │   Ticket     │  │   Ticket     │  │   Ticket     │    │   │
│  │  │   AIB-123    │  │   AIB-124    │  │   AIB-125    │    │   │
│  │  │   (source)   │  │   (target)   │  │   (target)   │    │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │   │
│  └─────────│─────────────────│─────────────────│────────────┘   │
│            │                 │                 │                 │
│  ┌─────────▼─────────────────▼─────────────────▼────────────┐   │
│  │                    Analysis Data                          │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────┐  │   │
│  │  │ Telemetry      │  │ Compliance     │  │ Metrics    │  │   │
│  │  │ (from Jobs)    │  │ (vs constit.)  │  │ (git diff) │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 FeatureAlignmentScore                     │   │
│  │  (Calculated from spec.md comparison across targets)      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Transitions

### Comparison Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Comment    │────▶│  Parsing    │────▶│  Validation │
│  Posted     │     │  Refs       │     │  Tickets    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Report     │◀────│  Analysis   │◀────│  Resolution │
│  Generated  │     │  Complete   │     │  Branches   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  Comment    │
│  Posted     │
└─────────────┘
```

### Resolution Status Flow

```
                    ┌────────────────┐
                    │ Database Lookup │
                    └────────┬───────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ resolved │   │ branch   │   │ merge    │
       │          │   │ missing  │   │ analyzed │
       └──────────┘   └────┬─────┘   └────┬─────┘
                           │              │
                           ▼              │
                    ┌──────────┐          │
                    │ Pattern  │──────────┘
                    │ Search   │
                    └────┬─────┘
                         │
                         ▼
                  ┌────────────┐
                  │unavailable │
                  └────────────┘
```

---

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Ticket references | 1-5 references | "Must compare 1-5 tickets" |
| Ticket references | Same project | "Tickets must be in same project" |
| Ticket references | Not self | "Cannot compare ticket to itself" |
| Ticket keys | Valid format | "Invalid ticket key format" |
| Tickets | Must exist | "Ticket {key} not found" |

---

## No Database Schema Changes

This feature operates entirely on existing data:
- **Tickets**: Read-only access to ticket records
- **Jobs**: Read-only access for telemetry aggregation
- **Comparison Reports**: Stored as markdown files in git

No Prisma migrations required.
