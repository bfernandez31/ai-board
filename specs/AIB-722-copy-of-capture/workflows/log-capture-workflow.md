# Log Capture Workflow

## Overview

The log capture workflow is triggered when a job reaches a terminal state (COMPLETED, FAILED, or CANCELLED). It captures the agent's execution logs, processes them into a standardized format, and stores them using hybrid storage (metadata in database, content in object storage).

## Workflow Definition

### Input

**Trigger**: Job status update to terminal state
**Source**: GitHub Actions workflow callback to `/api/jobs/[id]/status`
**Required Data**:
- `jobId`: Job identifier
- `agentType`: Agent that executed the job (CLAUDE, CODEX, MISTRAL, GEMINI)
- `logContent`: Raw log output from agent execution
- `logFormat`: Format of log content ('text' or 'json')
- `workflowRunId`: GitHub Actions workflow run ID (optional)

### Phases

#### Phase 1: Log Collection (GitHub Actions)

**Location**: GitHub Actions workflow
**Responsibility**: Workflow runner
**Operations**:
1. Capture stdout/stderr from agent execution
2. Collect tool invocation logs
3. Gather timing and metadata
4. Package into log bundle
5. Send to API endpoint

**Output**: HTTP POST request to `/api/jobs/[id]/logs`

#### Phase 2: Request Validation (API Layer)

**Location**: `app/api/jobs/[id]/logs/route.ts`
**Responsibility**: API endpoint
**Operations**:
1. Validate workflow authentication
2. Parse and validate request body with Zod
3. Check job exists and is in terminal state
4. Validate log size (<10MB)
5. Check for duplicate log submission

**Error Handling**:
- 401 Unauthorized: Invalid workflow credentials
- 400 Bad Request: Validation failures
- 404 Not Found: Job doesn't exist
- 409 Conflict: Log already captured

#### Phase 3: Log Processing (Service Layer)

**Location**: `lib/services/log-service.ts`
**Responsibility**: Log processing service
**Operations**:
1. Parse raw log content based on format
2. Normalize to standard LogEntry structure
3. Extract key events for preview
4. Generate summary statistics
5. Validate log structure

**Processing Rules**:
- Text logs: Parse line-by-line, detect message types
- JSON logs: Validate structure, extract entries
- Tool invocations: Identify and categorize
- Errors: Highlight and count
- Timestamps: Normalize to ISO format

#### Phase 4: Hybrid Storage (Storage Layer)

**Location**: `lib/services/storage-service.ts`
**Responsibility**: Storage service
**Operations**:
1. Generate storage key: `logs/{jobId}/{timestamp}.json`
2. Upload normalized log to S3
3. Generate content hash (SHA-256)
4. Create database records (JobLog, LogEntry, LogStorage)
5. Set expiration date (30 days from creation)

**Storage Details**:
- **S3 Bucket**: Configured via environment variables
- **Content-Type**: `application/json`
- **ACL**: Private (only accessible via presigned URLs)
- **Retention**: 30-day lifecycle policy

#### Phase 5: Database Persistence (Database Layer)

**Location**: Prisma operations
**Responsibility**: Database service
**Operations**:
1. Create JobLog record with metadata
2. Create LogEntry records for each entry
3. Create LogStorage record with S3 reference
4. Update Job record with log reference
5. Commit transaction

**Database Schema**:
```prisma
model JobLog {
  id              Int       @id @default(autoincrement())
  jobId           Int       @unique
  agentType       Agent
  status          String    @db.VarChar(20)
  timestamp       DateTime  @default(now())
  previewContent  String    @db.VarChar(2000)
  storageLocation String    @db.VarChar(100)
  contentSize     Int
  contentHash     String    @db.VarChar(64)
  expirationDate  DateTime
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

#### Phase 6: Completion (API Layer)

**Location**: `app/api/jobs/[id]/logs/route.ts`
**Responsibility**: API endpoint
**Operations**:
1. Return success response with log metadata
2. Log operation metrics
3. Trigger post-capture hooks (if any)

**Success Response**:
```json
{
  "success": true,
  "jobLogId": 123,
  "storageLocation": "s3://bucket/logs/456/20240423143022.json",
  "previewContent": "[first 2000 chars]",
  "contentSize": 12345,
  "expirationDate": "2024-05-23T14:30:22.000Z",
  "createdAt": "2024-04-23T14:30:22.000Z"
}
```

### Error Handling & Retries

**Retry Policy**:
- Max 3 attempts for storage operations
- Exponential backoff: 1s, 3s, 9s
- Failed after 3 attempts: Mark as FAILED, log error

**Error Scenarios**:
1. **S3 Unavailable**: Queue for retry, return 503
2. **Database Error**: Rollback transaction, return 500
3. **Invalid Log Format**: Return 400 with details
4. **Size Limit Exceeded**: Return 413, truncate if possible

**Recovery**:
- Idempotent operations (safe to retry)
- Atomic transactions (no partial state)
- Comprehensive logging for debugging

## Agent Command Specification

### Command: Capture Logs

**Command**: `ai-board logs capture`
**Description**: Capture and store agent execution logs
**Trigger**: Automatic (job completion) or Manual (CLI)

**Parameters**:
```typescript
interface CaptureLogsCommand {
  jobId: number;          // Target job ID
  agentType: Agent;       // Agent type
  logContent: string;     // Raw log content
  logFormat: 'text' | 'json'; // Content format
  force?: boolean;       // Overwrite existing logs
}
```

**Execution Phases**:
1. **Validation**: Check parameters and permissions
2. **Processing**: Normalize and structure logs
3. **Storage**: Store in hybrid system
4. **Notification**: Update job status and notify users

**Exit Codes**:
- 0: Success
- 1: Validation error
- 2: Storage error
- 3: Database error
- 4: Network error

## Callback/Reporting Contract

### Status Reporting

**Method**: HTTP response codes and body
**Format**: JSON with standardized structure

**Success**:
```json
{
  "success": true,
  "jobLogId": 123,
  "message": "Log captured successfully"
}
```

**Failure**:
```json
{
  "success": false,
  "error": "Storage unavailable",
  "code": "STORAGE_ERROR",
  "retryAfter": 5
}
```

### Monitoring Events

**Events Emitted**:
- `log_capture_started`: Workflow initiation
- `log_capture_success`: Successful completion
- `log_capture_failed`: Failure with details
- `log_storage_warning`: Storage approaching limits

**Metrics Collected**:
- Capture latency
- Log size distribution
- Error rates by agent type
- Storage usage growth

## Security Considerations

### Authentication
- Workflow authentication required
- Validated via `validateWorkflowAuth()`
- Secrets managed via environment variables

### Authorization
- Only workflows can capture logs
- Users can only view logs for jobs they have access to
- Access control same as ticket data

### Data Protection
- Logs stored with private ACL
- Presigned URLs for temporary access
- Content hash verification
- 30-day automatic expiration

## Performance Optimization

### Caching
- Log metadata cached for 5 minutes
- Preview content cached for 1 minute
- Database query results cached

### Batch Processing
- Log entries inserted in batches
- S3 uploads use multipart for large logs
- Database operations in transactions

### Concurrency Control
- Idempotent operations
- Atomic updates
- Optimistic concurrency control

## Environment Requirements

### Configuration
```env
# S3 Configuration
AWS_S3_BUCKET=ai-board-logs
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Log Settings
LOG_RETENTION_DAYS=30
LOG_MAX_SIZE_MB=10
```

### Dependencies
- AWS SDK v3
- Prisma Client
- Zod for validation
- Date-fns for date handling

## Testing Strategy

### Unit Tests
- Log parsing functions
- Normalization algorithms
- Validation schemas

### Integration Tests
- Full workflow execution
- Error scenarios
- Retry behavior

### End-to-End Tests
- Workflow to API to storage
- User access patterns
- Performance benchmarks

## Monitoring and Alerting

### Key Metrics
- Capture success rate
- Average log size
- Storage usage
- Processing latency

### Alert Thresholds
- Success rate < 95%
- Storage usage > 80% capacity
- Latency > 2s
- Error rate > 5%

## Rollback Procedure

1. **Disable Capture**: Set feature flag to false
2. **Cleanup Data**: Remove JobLog/LogEntry records
3. **Delete Objects**: Remove S3 objects
4. **Monitor**: Verify no orphaned data
5. **Notify**: Inform users of temporary unavailability

## Success Criteria

- ✅ 99% capture success rate
- ✅ <2s average processing time
- ✅ <10MB average log size
- ✅ 30-day retention enforced
- ✅ Access control validated
- ✅ No data loss or corruption
