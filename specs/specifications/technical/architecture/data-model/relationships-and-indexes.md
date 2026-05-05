# Relationships & Indexes

## Relationships Diagram

```
User
├── projects (one-to-many) → Project
│   ├── tickets (one-to-many) → Ticket
│   │   ├── jobs (one-to-many) → Job
│   │   │   └── log (one-to-one, optional) → JobLog
│   │   ├── comments (one-to-many) → Comment
│   │   │   └── notifications (one-to-many) → Notification
│   │   ├── notifications (one-to-many) → Notification
│   │   ├── comparisonParticipants (one-to-many) → ComparisonParticipant
│   │   ├── outcome (one-to-one, optional) → TicketOutcome
│   │   ├── analyses (one-to-many) → TicketAnalysis
│   │   └── calibration (one-to-one, optional) → AnalysisCalibration
│   ├── outcomes (one-to-many) → TicketOutcome
│   ├── analyses (one-to-many) → TicketAnalysis
│   ├── calibrations (one-to-many) → AnalysisCalibration
│   ├── comparisonRecords (one-to-many) → ComparisonRecord
│   │   ├── participants (one-to-many) → ComparisonParticipant
│   │   │   ├── metricSnapshot (one-to-one) → TicketMetricSnapshot
│   │   │   └── complianceAssessments (one-to-many) → ComplianceAssessment
│   │   └── decisionPoints (one-to-many) → DecisionPointEvaluation
│   ├── jobs (one-to-many) → Job
│   └── projectMembers (one-to-many) → ProjectMember
├── comments (one-to-many) → Comment
├── projectMembers (one-to-many) → ProjectMember
├── receivedNotifications (one-to-many) → Notification (as recipient)
├── createdNotifications (one-to-many) → Notification (as actor)
├── subscription (one-to-one) → Subscription
├── credentials (one-to-many) → UserCredential
│   └── unique on (userId, provider)
├── ticketAnalyses (one-to-many) → TicketAnalysis (as trigger)
└── accounts/sessions (one-to-many) → NextAuth tables
```

## Indexes Strategy

### Performance Indexes

**Project Filtering**:
- `Project(userId)` - User's projects query
- `Project(githubOwner, githubRepo)` - Repository lookup

**Ticket Queries**:
- `Ticket(projectId)` - Project's tickets
- `Ticket(projectId, stage)` - Board view filtering
- `Ticket(projectId, workflowType)` - Workflow type filtering

**Job Queries**:
- `Job(ticketId, status, startedAt)` - Job completion validation
- `Job(projectId)` - Project job polling
- `Job(ticketId)` - Job history per ticket
- `Job(status)` - Running jobs query

**Job Log Queries**:
- `JobLog(jobId)` - Unique one-to-one lookup from a job
- `JobLog(captureStatus, createdAt)` - Retention prune scan (filter on age + skip already-PRUNED rows)
- `JobLog(createdAt)` - Prune ordering

**Comment Queries**:
- `Comment(ticketId, createdAt)` - Chronological sorting
- `Comment(userId)` - Author filtering

**Notification Queries**:
- `Notification(recipientId, read, createdAt)` - Unread notification sorting
- `Notification(recipientId, deletedAt)` - Active notifications (soft-delete filtering)
- `Notification(commentId)` - Notification lookup by source comment

**Collaboration**:
- `ProjectMember(projectId)` - Project members list
- `ProjectMember(userId)` - User's projects
- `ProjectMember(projectId, userId)` - Unique constraint + lookup

**Outcome Queries**:
- `TicketOutcome(ticketId)` - Unique 1:1 with Ticket; idempotency guard
- `TicketOutcome(projectId, shippedAt DESC)` - Project outcomes listing newest-first
- `TicketOutcome(projectId, frictionFree)` - Fraction-frictionFree aggregate per project
- `TicketOutcome(projectId, partial)` - Filter partial rows out of analytics
- `TicketOutcome(shippedAt)` - Cross-project time-window queries

**Analysis Queries**:
- `TicketAnalysis(ticketId, createdAt DESC)` - Latest analysis lookup for the panel render path
- `TicketAnalysis(userId, status, endedAt)` - Rolling-hour rate-limit count (filtered to `success` and `cold_start`)
- `TicketAnalysis(projectId, createdAt DESC)` - Project-scoped analytics over historical analyses
- `TicketAnalysis(status, startedAt)` - Observability for orphaned `running` rows (workflow timeouts)

**Calibration Queries**:
- `AnalysisCalibration(ticketId)` - Unique 1:1 with Ticket; pairing idempotency guard
- `AnalysisCalibration(analysisId)` - Unique; defensive guarantee that no analysis row is paired twice
- `AnalysisCalibration(outcomeId)` - Unique; defensive guarantee that no outcome row is paired twice
- `AnalysisCalibration(projectId, shippedAt DESC)` - Dashboard 30-row window, newest-first
- `AnalysisCalibration(projectId, partial)` - Dashboard headline-rate filters that exclude partials
- `AnalysisCalibration(projectId, frictionCell)` - Dashboard confusion-matrix counts via `groupBy`

**Comparison Queries**:
- `ComparisonRecord(projectId, generatedAt DESC)` - Project comparisons listing
- `ComparisonRecord(sourceTicketId, generatedAt DESC)` - Source ticket lookups
- `ComparisonRecord(winnerTicketId, generatedAt DESC)` - Winner ticket lookups
- `ComparisonParticipant(ticketId, createdAt DESC)` - Ticket participation history
- `ComparisonParticipant(comparisonRecordId, rank)` - Ranked participants
- `DecisionPointEvaluation(comparisonRecordId, displayOrder)` - Ordered decision points
- `ComplianceAssessment(comparisonParticipantId, displayOrder)` - Ordered assessments

### Composite Indexes

Used for multi-column queries with optimal performance:

- `Job(ticketId, status, startedAt)`: Efficient job completion validation
- `Ticket(projectId, stage)`: Board view with stage filtering
- `Ticket(projectId, workflowType)`: Workflow type filtering per project
- `Comment(ticketId, createdAt)`: Comment timeline sorting
- `ProjectMember(projectId, userId)`: Unique membership constraint
- `Notification(recipientId, read, createdAt)`: Unread notification queries with sorting
- `Notification(recipientId, deletedAt)`: Active notification filtering (soft delete)
- `TicketOutcome(projectId, shippedAt DESC)`: Newest-first project outcome listing
- `TicketOutcome(projectId, frictionFree)`: Index-supported fraction-frictionFree aggregate
- `TicketOutcome(projectId, partial)`: Filter partial rows out of analytics queries
- `TicketAnalysis(ticketId, createdAt DESC)`: Latest-row lookup serving the panel render path
- `TicketAnalysis(userId, status, endedAt)`: Per-user rolling-hour rate-limit count
- `AnalysisCalibration(projectId, shippedAt DESC)`: Newest-first calibration row window for the drift dashboard
- `AnalysisCalibration(projectId, partial)`: Filter partial calibration rows out of headline rate denominators
- `AnalysisCalibration(projectId, frictionCell)`: Confusion-matrix `groupBy` aggregation per project

