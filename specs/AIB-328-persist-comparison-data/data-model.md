# Data Model: Persist Comparison Data

**Date**: 2026-03-21 | **Branch**: `AIB-328-persist-comparison-data`

## Existing Entities (No Schema Changes)

This feature requires **NO new database models or migrations**. All persistence uses existing Prisma models defined in `prisma/schema.prisma`:

### ComparisonRecord (line 349)
| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | Auto-increment |
| projectId | Int (FK → Project) | Required |
| sourceTicketId | Int (FK → Ticket) | Ticket that triggered comparison |
| winnerTicketId | Int (FK → Ticket) | Determined by compliance/metrics ranking |
| markdownPath | String | Path to the markdown report file |
| summary | String | Executive summary text |
| overallRecommendation | String | AI recommendation text |
| keyDifferentiators | Json | JSON array of differentiator strings |
| generatedAt | DateTime | Report generation timestamp |
| createdAt | DateTime | Record creation timestamp |

### ComparisonParticipant (line 371)
| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | Auto-increment |
| comparisonRecordId | Int (FK) | Parent comparison |
| ticketId | Int (FK → Ticket) | Participating ticket |
| rank | Int | 1-based ranking |
| score | Float | Compliance/quality score |
| rankRationale | String | Explanation for rank |
| workflowTypeAtComparison | WorkflowType | Snapshot at comparison time |
| agentAtComparison | Agent? | Snapshot at comparison time |

### TicketMetricSnapshot (line 392)
| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | Auto-increment |
| participantId | Int (FK, unique) | 1:1 with participant |
| linesAdded | Int | |
| linesRemoved | Int | |
| linesChanged | Int | |
| filesChanged | Int | |
| testFilesChanged | Int | |
| changedFiles | Json | String array |
| bestValueFlags | Json | Object marking best values |

### DecisionPointEvaluation (line 406)
| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | Auto-increment |
| comparisonRecordId | Int (FK) | Parent comparison |
| title | String | Decision point title |
| verdictTicketId | Int (FK → Ticket) | Winner for this point |
| verdictSummary | String | Summary of verdict |
| rationale | String | Detailed rationale |
| participantApproaches | Json | Array of {ticketId, ticketKey, summary} |
| displayOrder | Int | Rendering order |

### ComplianceAssessment (line 424)
| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | Auto-increment |
| participantId | Int (FK) | Parent participant |
| principleKey | String | Constitution section ID |
| principleName | String | Principle display name |
| status | String | "pass", "mixed", or "fail" |
| notes | String | Assessment details |
| displayOrder | Int | Rendering order |

## New Artifact: Comparison Data JSON File

**Not a database entity** — ephemeral file written by the `/compare` command, read by the workflow, then left in-place alongside the markdown report.

### Schema (TypeScript)
```typescript
// Matches PersistComparisonInput from lib/comparison/comparison-record.ts
type ComparisonDataFile = {
  projectId: number;
  sourceTicket: PersistableTicket;
  participants: PersistableTicket[];
  markdownPath: string;
  report: ComparisonReport;
};

type PersistableTicket = {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;          // "INBOX" | "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP" | "CLOSED"
  workflowType: WorkflowType;  // "FULL" | "QUICK" | "CLEAN"
  agent: Agent | null;   // "CLAUDE" | "CODEX" | null
};
```

### Validation Rules
- `projectId`: Must reference an existing project
- `sourceTicket.id` and each `participants[].id`: Must reference existing tickets in the project
- `markdownPath`: Must be a non-empty string
- `report`: Must contain valid `metadata`, `summary`, `alignment`, `implementation`, `compliance`, `telemetry`, `recommendation`, `warnings` fields
- `report.metadata.comparedTickets`: Must be non-empty array

## State Transitions

No state transitions are introduced. The comparison record is a point-in-time snapshot — it is created once and never updated. Multiple comparisons for the same tickets produce separate records.

## Relationships

```
Project ──1:N──→ ComparisonRecord
Ticket ──1:N──→ ComparisonRecord (as source)
Ticket ──1:N──→ ComparisonRecord (as winner)
ComparisonRecord ──1:N──→ ComparisonParticipant
ComparisonParticipant ──1:1──→ TicketMetricSnapshot
ComparisonParticipant ──1:N──→ ComplianceAssessment
ComparisonRecord ──1:N──→ DecisionPointEvaluation
```
