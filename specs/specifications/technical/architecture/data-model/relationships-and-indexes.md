# Relationships & Indexes

## Relationships Diagram

```
User
├── projects (one-to-many) → Project
│   ├── tickets (one-to-many) → Ticket
│   │   ├── jobs (one-to-many) → Job
│   │   │   └── jobLog (one-to-one, optional) → JobLog
│   │   ├── comments (one-to-many) → Comment
│   │   │   └── notifications (one-to-many) → Notification
│   │   ├── notifications (one-to-many) → Notification
│   │   └── comparisonParticipants (one-to-many) → ComparisonParticipant
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
- `JobLog(jobId)` - Unique lookup of a job's captured log (upsert on workflow retry)
- `JobLog(createdAt)` - Retention pruning cutoff (30-day window)

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

