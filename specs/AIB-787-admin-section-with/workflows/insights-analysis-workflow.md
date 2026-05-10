# Insights Analysis Workflow

## Workflow Definition

**ID**: `claude-code-insights-analysis`
**Type**: `CLAUDE_CODE_INSIGHTS`
**Description**: Generate insights report from Claude Code agent sessions

## Input Specification

### Required Inputs
- `requestedBy`: User ID of admin requesting analysis
- `period`: Analysis period (optional, defaults to "since last successful run")
  - `start`: ISO 8601 timestamp
  - `end`: ISO 8601 timestamp
- `projectId`: Project ID filter (optional, defaults to all projects)

### Input Validation
- `period.end` must be ≤ current time
- `period.start` must be ≤ `period.end`
- If `projectId` provided, must exist in database
- `requestedBy` must have admin access

## Phases

### 1. Pre-flight Check
**ID**: `pre-flight`
**Purpose**: Validate conditions before starting analysis

**Checks**:
1. Verify user has admin access
2. Check if another analysis is already running
3. Determine analysis period:
   - If not specified: use time since last successful run
   - If specified: use provided period
4. Count new shipped tickets since last run
5. Verify at least 1 new ticket exists (unless forced)

**Output**:
```typescript
{
  hasNewTickets: boolean,
  lastRunAt?: string,
  ticketCountSinceLastRun: number,
  analysisPeriod: {
    start: string,
    end: string
  }
}
```

**Error Conditions**:
- `NO_NEW_TICKETS`: No new tickets since last run
- `ALREADY_RUNNING`: Another analysis job is running
- `INVALID_PERIOD`: Specified period is invalid

### 2. Session Download
**ID**: `session-download`
**Purpose**: Fetch Claude Code session artifacts

**Process**:
1. Query database for sessions in analysis period
2. Filter for Claude Code agent sessions only
3. Download raw session artifacts from blob storage
4. Validate artifact integrity

**Output**:
```typescript
{
  sessionCount: number,
  downloadedSize: number,
  artifacts: string[], // Blob storage keys
  sessions: SessionData[] // Parsed session data
}
```

**Error Conditions**:
- `NO_SESSIONS_FOUND`: No sessions match criteria
- `DOWNLOAD_FAILED`: Failed to download artifacts
- `INVALID_ARTIFACT`: Artifact corruption detected

### 3. Analysis Execution
**ID**: `analysis-execution`
**Purpose**: Run Claude Code insights analyzer

**Process**:
1. Prepare analysis payload with session data
2. Call Claude Code `/insights` API endpoint
3. Stream analysis progress
4. Validate analysis output

**Input to Claude API**:
```typescript
{
  sessions: SessionData[],
  period: {
    start: string,
    end: string
  },
  metrics: {
    sessionCount: number,
    ticketCount: number
  }
}
```

**Output**:
```typescript
{
  htmlReport: string, // Generated HTML report
  analysisId: string, // Claude analysis ID
  modelUsed: string, // Claude model version
  metrics: {
    inputTokens: number,
    outputTokens: number,
    durationMs: number
  }
}
```

**Error Conditions**:
- `CLAUDE_API_ERROR`: Claude API returned error
- `ANALYSIS_TIMEOUT`: Analysis took too long
- `INVALID_OUTPUT`: Output validation failed

### 4. Report Persistence
**ID**: `report-persistence`
**Purpose**: Store generated report

**Process**:
1. Generate unique report key
2. Upload HTML report to blob storage
3. Verify upload integrity
4. Record storage metadata

**Output**:
```typescript
{
  reportKey: string, // Blob storage key
  reportSize: number, // Bytes
  storageProvider: string, // e.g., "vercel-blob"
  checksum: string // SHA-256 hash
}
```

**Error Conditions**:
- `UPLOAD_FAILED`: Blob storage upload failed
- `CHECKSUM_MISMATCH`: Integrity verification failed

### 5. Metadata Storage
**ID**: `metadata-storage`
**Purpose**: Save report metadata to database

**Process**:
1. Create InsightsReport record
2. Update related Job record
3. Create audit log entry
4. Trigger notifications

**Database Operations**:
```prisma
// Create InsightsReport
const report = await prisma.insightsReport.create({
  data: {
    generatedAt: new Date(),
    periodStart: analysisPeriod.start,
    periodEnd: analysisPeriod.end,
    sessionCount: sessionCount,
    ticketCount: ticketCount,
    reportKey: reportKey,
    reportSize: reportSize,
    status: 'COMPLETED',
    jobId: job.id,
    createdBy: requestedBy,
    projectId: projectId
  }
})

// Update Job
await prisma.job.update({
  where: { id: job.id },
  data: {
    status: 'COMPLETED',
    completedAt: new Date(),
    insightsReportId: report.id,
    analysisType: 'CLAUDE_CODE_INSIGHTS'
  }
})
```

**Output**:
```typescript
{
  reportId: string,
  jobId: number,
  auditLogId: string
}
```

**Error Conditions**:
- `DB_CONSTRAINT_VIOLATION`: Database constraint violated
- `DB_CONNECTION_FAILED`: Database unavailable

## Environment Requirements

### Runtime Requirements
- Node.js 18+
- Database connection
- Blob storage credentials
- Claude API credentials
- Memory: Minimum 512MB (1GB recommended for large datasets)

### Configuration Variables
```env
# Claude API
CLAUDE_API_KEY=sk-claude-...
CLAUDE_INSIGHTS_ENDPOINT=https://api.anthropic.com/v1/insights

# Blob Storage
BLOB_STORAGE_PROVIDER=vercel
BLOB_STORAGE_TOKEN=...
BLOB_STORAGE_BUCKET=ai-board-reports

# Database
DATABASE_URL=postgresql://...

# Analysis Limits
MAX_SESSIONS_PER_ANALYSIS=10000
ANALYSIS_TIMEOUT_MS=3600000
```

## Error Handling Strategy

### Phase-Specific Error Handling

| Phase | Error Type | Recovery Strategy |
|-------|-----------|-------------------|
| Pre-flight | `NO_NEW_TICKETS` | Return friendly message to user |
| Pre-flight | `ALREADY_RUNNING` | Return 409 Conflict |
| Session Download | `NO_SESSIONS_FOUND` | Mark job as completed with empty report |
| Analysis Execution | `CLAUDE_API_ERROR` | Retry once, then fail |
| Report Persistence | `UPLOAD_FAILED` | Retry 3 times, then fail |
| Metadata Storage | `DB_CONSTRAINT_VIOLATION` | Rollback and fail |

### Global Error Handling
1. **Logging**: All errors logged with context (jobId, phase, userId)
2. **Cleanup**: Partial artifacts cleaned up on failure
3. **Notification**: Admin notified of critical failures
4. **Retry Policy**: Non-retryable errors fail immediately, retryable errors attempt 1-3 retries

### Rollback Strategy
- **Session Download**: Delete downloaded artifacts
- **Analysis Execution**: No cleanup needed (stateless)
- **Report Persistence**: Delete uploaded report if metadata storage fails
- **Metadata Storage**: Transaction rollback on failure

## Monitoring and Observability

### Metrics to Track
- Analysis duration
- Session count per analysis
- Token usage
- Success/failure rates
- Error types and frequencies

### Logging Levels
- **INFO**: Phase transitions, major milestones
- **DEBUG**: Detailed progress, API call/response
- **WARN**: Retry attempts, non-critical issues
- **ERROR**: Failures, exceptions

### Alerting
- **Critical**: Consecutive failures (>3)
- **Warning**: Slow analyses (>50% of timeout)
- **Info**: Large analyses (>5000 sessions)

## Security Considerations

### Data Protection
- Session data treated as confidential
- Reports contain aggregated data only (no PII)
- Blob storage uses signed URLs with expiration

### Access Control
- Only admin users can trigger analysis
- Report access logged and auditable
- API endpoints require authentication

### Input Validation
- All inputs validated against schemas
- Period validation prevents excessive data requests
- Rate limiting on analysis triggers

## Performance Optimization

### Caching Strategy
- Cache last successful analysis period
- Cache session counts for quick pre-flight checks
- Cache report metadata for listing

### Batch Processing
- Process sessions in batches of 100
- Stream analysis to reduce memory usage
- Parallel download of session artifacts

### Resource Limits
- Maximum 10,000 sessions per analysis
- 1 hour timeout for analysis execution
- 500MB maximum report size

## Testing Strategy

### Unit Tests
- Phase validation logic
- Input/output schema validation
- Error handling for each phase

### Integration Tests
- End-to-end workflow execution
- Database operations
- Blob storage interactions
- Error recovery scenarios

### Load Tests
- Maximum session capacity
- Concurrent analysis requests
- Memory usage under load

### Regression Tests
- Backward compatibility with existing reports
- Schema evolution handling
- API contract stability
