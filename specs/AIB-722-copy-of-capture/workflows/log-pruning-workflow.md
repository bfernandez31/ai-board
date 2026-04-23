# Log Pruning Workflow

## Overview

The log pruning workflow is a scheduled job that automatically removes expired logs according to the 30-day retention policy. It ensures storage doesn't grow indefinitely while maintaining logs for the required debugging window.

## Workflow Definition

### Input

**Trigger**: Scheduled cron job (daily at 2:00 AM UTC)
**Source**: System scheduler or external cron service
**Required Data**: Current date/time for expiration calculation

### Phases

#### Phase 1: Identification (Database Query)

**Location**: `lib/services/log-pruning-service.ts`
**Responsibility**: Pruning service
**Operations**:
1. Calculate expiration threshold (current date - 30 days)
2. Query database for expired JobLog records
3. Batch records for processing (100 at a time)
4. Lock records to prevent concurrent modification

**Query**:
```sql
SELECT id, jobId, storageLocation, contentHash
FROM JobLog
WHERE expirationDate < NOW()
AND status = 'COMPLETED'
LIMIT 100 FOR UPDATE SKIP LOCKED
```

**Output**: Batch of expired log records

#### Phase 2: Validation (Pre-Pruning Checks)

**Location**: `lib/services/log-pruning-service.ts`
**Responsibility**: Pruning service
**Operations**:
1. Verify log existence in database
2. Check storage reference integrity
3. Validate no active references
4. Log pre-pruning state for audit

**Validation Rules**:
- Log must exist in database
- Storage reference must be valid
- No active user sessions accessing log
- Job must still exist (not deleted)

#### Phase 3: Storage Cleanup (S3 Deletion)

**Location**: `lib/services/storage-service.ts`
**Responsibility**: Storage service
**Operations**:
1. Extract storage key from LogStorage record
2. Delete object from S3
3. Verify deletion success
4. Handle S3 errors gracefully

**S3 Operation**:
```typescript
await s3.send(new DeleteObjectCommand({
  Bucket: process.env.AWS_S3_BUCKET,
  Key: storageKey,
}));
```

**Error Handling**:
- Retry transient errors (3 attempts)
- Log permanent errors
- Continue with database cleanup even if S3 fails

#### Phase 4: Database Cleanup (Soft Delete)

**Location**: Prisma operations
**Responsibility**: Database service
**Operations**:
1. Update JobLog status to 'PRUNED'
2. Set deletedAt timestamp
3. Update LogStorage with deletion metadata
4. Preserve records for audit trail

**Database Operations**:
```prisma
await prisma.jobLog.update({
  where: { id: logId },
  data: {
    status: 'PRUNED',
    deletedAt: new Date(),
  },
});

await prisma.logStorage.update({
  where: { jobLogId: logId },
  data: {
    deletedAt: new Date(),
    deletionReason: 'RETENTION_POLICY',
  },
});
```

#### Phase 5: Audit Logging (Tracking)

**Location**: `lib/services/log-pruning-service.ts`
**Responsibility**: Pruning service
**Operations**:
1. Create audit log entry
2. Record pruning details
3. Track storage reclaimed
4. Emit monitoring events

**Audit Log Structure**:
```typescript
interface PruningAuditLog {
  id: number;
  jobLogId: number;
  jobId: number;
  storageLocation: string;
  contentSize: number;
  prunedAt: Date;
  prunedBy: 'AUTOMATED' | 'MANUAL';
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errorMessage?: string;
}
```

#### Phase 6: Completion (Finalization)

**Location**: `app/api/admin/logs/prune/route.ts`
**Responsibility**: API endpoint
**Operations**:
1. Return pruning summary
2. Update monitoring metrics
3. Schedule next batch if more logs exist

**Success Response**:
```json
{
  "success": true,
  "logsProcessed": 100,
  "logsSuccessfullyPruned": 95,
  "logsFailed": 5,
  "storageReclaimedBytes": 12345678,
  "nextBatchExists": true,
  "completedAt": "2024-04-24T02:30:15.000Z"
}
```

### Error Handling & Recovery

**Error Scenarios**:
1. **Database Lock Timeout**: Skip locked records, continue with next batch
2. **S3 Unavailable**: Log error, mark as partial success, continue
3. **Validation Failure**: Skip invalid record, log details
4. **Concurrency Conflict**: Retry with exponential backoff

**Recovery Strategies**:
- **Idempotent Operations**: Safe to retry failed prunes
- **Audit Trail**: Track all operations for debugging
- **Manual Intervention**: Flag problematic logs for admin review
- **Partial Success**: Continue processing even with some failures

## Agent Command Specification

### Command: Prune Logs

**Command**: `ai-board logs prune`
**Description**: Manual log pruning for administrative purposes
**Trigger**: CLI or scheduled job

**Parameters**:
```typescript
interface PruneLogsCommand {
  dryRun?: boolean;          // Preview without deletion
  batchSize?: number;       // Records per batch (default: 100)
  maxRecords?: number;      // Maximum records to process
  force?: boolean;          // Bypass safety checks
  beforeDate?: string;      // Custom expiration date
}
```

**Execution Phases**:
1. **Validation**: Check parameters and permissions
2. **Identification**: Query expired logs
3. **Confirmation**: Show preview in dry-run mode
4. **Execution**: Perform pruning operations
5. **Reporting**: Display summary and results

**Exit Codes**:
- 0: Success
- 1: Validation error
- 2: Database error
- 3: Storage error
- 4: Partial success (some failures)

## Callback/Reporting Contract

### Status Reporting

**Method**: HTTP response and monitoring events
**Format**: JSON with standardized structure

**Success**:
```json
{
  "success": true,
  "message": "Pruning completed successfully",
  "stats": {
    "totalProcessed": 100,
    "successful": 98,
    "failed": 2,
    "storageReclaimed": "12.4MB"
  }
}
```

**Failure**:
```json
{
  "success": false,
  "error": "Database connection failed",
  "code": "DATABASE_ERROR",
  "processedBeforeFailure": 42,
  "retryable": true
}
```

### Monitoring Events

**Events Emitted**:
- `pruning_started`: Job initiation with parameters
- `pruning_batch_processed`: Batch completion with stats
- `pruning_completed`: Job completion with summary
- `pruning_error`: Error encountered with details

**Metrics Collected**:
- Logs pruned per run
- Storage reclaimed
- Processing time
- Error rates
- Batch sizes

## Security Considerations

### Authentication
- Admin-only endpoint
- Requires elevated permissions
- Audit all access

### Authorization
- Only system admins can trigger manual pruning
- Automated pruning runs with system credentials
- Access logged and monitored

### Data Protection
- Soft delete preserves audit trail
- No sensitive data exposed in logs
- Operations logged for compliance

## Performance Optimization

### Batch Processing
- Process 100 logs per batch
- Parallel S3 deletions (max 10 concurrent)
- Database operations in transactions

### Resource Management
- Memory-efficient streaming
- Connection pooling
- Timeout management

### Scheduling
- Off-peak execution (2:00 AM UTC)
- Configurable batch sizes
- Rate limiting for S3 operations

## Environment Requirements

### Configuration
```env
# Pruning Settings
LOG_RETENTION_DAYS=30
PRUNING_BATCH_SIZE=100
PRUNING_MAX_CONCURRENT_S3=10
PRUNING_SCHEDULE="0 2 * * *"

# Database
DATABASE_URL=...
```

### Dependencies
- AWS SDK v3
- Prisma Client
- Date-fns for date calculations
- Pino for structured logging

## Testing Strategy

### Unit Tests
- Expiration calculation logic
- Batch processing algorithms
- Error handling scenarios

### Integration Tests
- Full pruning workflow
- Database + S3 interactions
- Concurrent execution

### End-to-End Tests
- Scheduled job execution
- Storage reclamation verification
- Audit trail validation

## Monitoring and Alerting

### Key Metrics
- Logs pruned per run
- Storage reclaimed
- Processing duration
- Error rates

### Alert Thresholds
- Failure rate > 10%
- Processing time > 30 minutes
- Storage not decreasing as expected
- Consecutive failures > 3

## Rollback Procedure

1. **Pause Pruning**: Disable scheduled job
2. **Restore Data**: Recover from backups if needed
3. **Investigate**: Identify root cause
4. **Fix**: Apply corrective measures
5. **Resume**: Re-enable with monitoring

## Success Criteria

- ✅ 95%+ pruning success rate
- ✅ Storage growth controlled
- ✅ No data loss or corruption
- ✅ Audit trail complete
- ✅ Performance targets met
- ✅ Retention policy enforced

## Disaster Recovery

### Data Loss Scenarios

1. **Accidental Pruning**:
   - Restore from database backups
   - Recover S3 objects from versioning
   - Reconstruct from audit logs if needed

2. **Corrupted Data**:
   - Isolate affected records
   - Restore from most recent good backup
   - Manual verification of critical logs

### Prevention Measures

- **Database Backups**: Daily snapshots, 30-day retention
- **S3 Versioning**: Enabled for log bucket
- **Dry Run Mode**: Preview before actual deletion
- **Audit Trail**: Complete history of all operations
- **Manual Review**: Flag anomalous pruning patterns

## Long-term Considerations

### Scaling
- Partition pruning by date ranges
- Distributed processing for large volumes
- Sharding for database operations

### Policy Changes
- Configurable retention periods
- Tiered storage (hot/cold)
- Custom retention by project or job type

### Compliance
- Legal hold capabilities
- Extended retention for critical jobs
- Export for archival purposes
