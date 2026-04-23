# Data Model: Agent Execution Logs

## Entities

### JobLog (New Entity)

Represents the captured execution log for a job.

**Attributes**:
- `id`: Int @id @default(autoincrement())
- `jobId`: Int @unique
- `agentType`: Agent
- `status`: String @db.VarChar(20)
- `timestamp`: DateTime @default(now())
- `previewContent`: String @db.VarChar(2000)
- `fullLogReference`: String @db.VarChar(255)
- `storageLocation`: String @db.VarChar(100)
- `contentSize`: Int
- `contentHash`: String @db.VarChar(64)
- `expirationDate`: DateTime
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relationships**:
- `job`: Job @relation(fields: [jobId], references: [id], onDelete: Cascade)
- `logEntries`: LogEntry[]

**Indexes**:
- `@@index([jobId])`
- `@@index([timestamp])`
- `@@index([status])`
- `@@index([expirationDate])`

### LogEntry (New Entity)

Individual log entries within a JobLog.

**Attributes**:
- `id`: Int @id @default(autoincrement())
- `jobLogId`: Int
- `sequenceNumber`: Int
- `timestamp`: DateTime
- `messageType`: String @db.VarChar(10) // INFO, ERROR, WARNING, TOOL
- `content`: String @db.Text
- `toolName`: String? @db.VarChar(50)
- `metadata`: Json?

**Relationships**:
- `jobLog`: JobLog @relation(fields: [jobLogId], references: [id], onDelete: Cascade)

**Indexes**:
- `@@index([jobLogId, sequenceNumber])`
- `@@index([jobLogId, messageType])`
- `@@index([jobLogId, timestamp])`

### LogStorage (New Entity)

Tracks physical storage of log content.

**Attributes**:
- `id`: Int @id @default(autoincrement())
- `jobLogId`: Int @unique
- `storageProvider`: String @db.VarChar(50)
- `storageKey`: String @db.VarChar(255)
- `contentSize`: Int
- `contentHash`: String @db.VarChar(64)
- `expirationDate`: DateTime
- `createdAt`: DateTime @default(now())

**Relationships**:
- `jobLog`: JobLog @relation(fields: [jobLogId], references: [id], onDelete: Cascade)

**Indexes**:
- `@@index([storageProvider])`
- `@@index([expirationDate])`

## Database Schema Changes

### Add to prisma/schema.prisma

```prisma
model JobLog {
  id                Int      @id @default(autoincrement())
  jobId             Int      @unique
  agentType         Agent
  status            String   @db.VarChar(20)
  timestamp         DateTime @default(now())
  previewContent    String   @db.VarChar(2000)
  fullLogReference  String   @db.VarChar(255)
  storageLocation   String   @db.VarChar(100)
  contentSize       Int
  contentHash       String   @db.VarChar(64)
  expirationDate    DateTime
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  job        Job        @relation(fields: [jobId], references: [id], onDelete: Cascade)
  logEntries LogEntry[]
  storage    LogStorage?

  @@index([jobId])
  @@index([timestamp])
  @@index([status])
  @@index([expirationDate])
}

model LogEntry {
  id              Int       @id @default(autoincrement())
  jobLogId        Int
  sequenceNumber  Int
  timestamp       DateTime
  messageType     String    @db.VarChar(10)
  content         String    @db.Text
  toolName        String?    @db.VarChar(50)
  metadata        Json?

  jobLog JobLog @relation(fields: [jobLogId], references: [id], onDelete: Cascade)

  @@index([jobLogId, sequenceNumber])
  @@index([jobLogId, messageType])
  @@index([jobLogId, timestamp])
}

model LogStorage {
  id              Int       @id @default(autoincrement())
  jobLogId        Int       @unique
  storageProvider String    @db.VarChar(50)
  storageKey      String    @db.VarChar(255)
  contentSize     Int
  contentHash     String    @db.VarChar(64)
  expirationDate  DateTime
  createdAt       DateTime  @default(now())

  jobLog JobLog @relation(fields: [jobLogId], references: [id], onDelete: Cascade)

  @@index([storageProvider])
  @@index([expirationDate])
}
```

## Validation Rules

### JobLog Validation
- `jobId` must reference an existing Job
- `agentType` must be a valid Agent enum value
- `status` must be one of: PENDING, PROCESSING, COMPLETED, FAILED
- `previewContent` must be ≤ 2000 characters
- `expirationDate` must be ≥ current date and ≤ 30 days from creation

### LogEntry Validation
- `jobLogId` must reference an existing JobLog
- `sequenceNumber` must be unique within a JobLog
- `messageType` must be one of: INFO, ERROR, WARNING, TOOL
- `timestamp` must be ≤ current date/time

### LogStorage Validation
- `jobLogId` must reference an existing JobLog
- `storageProvider` must be a valid provider (e.g., S3, GCS)
- `expirationDate` must match JobLog expirationDate

## State Transitions

### JobLog Lifecycle
```
PENDING → PROCESSING → COMPLETED
          → FAILED
```

### Transition Rules
1. **PENDING → PROCESSING**: Log capture initiated
2. **PROCESSING → COMPLETED**: Log successfully stored
3. **PROCESSING → FAILED**: Log storage failed
4. **COMPLETED/FAILED → COMPLETED/FAILED**: Idempotent (retry safety)

## Storage Strategy

### Hybrid Storage Implementation

1. **Database (PostgreSQL)**:
   - JobLog metadata (agentType, status, timestamps)
   - Preview content (first 2000 chars)
   - LogEntry structured data for filtering/searching

2. **Object Storage (S3)**:
   - Full log content as JSON
   - Storage key format: `logs/{jobId}/{timestamp}.json`
   - Content-Type: `application/json`
   - Retention: 30 days with lifecycle policy

### Storage Key Format
```
logs/{jobId}/{createdAtTimestamp}.json
```

Example: `logs/123/20240423143022.json`

## API Contracts

### Log Capture Request
```typescript
interface LogCaptureRequest {
  jobId: number;
  agentType: Agent;
  logContent: string; // Raw log content from agent
  logFormat: 'text' | 'json'; // Format of logContent
}
```

### Log Retrieval Response
```typescript
interface LogRetrievalResponse {
  jobId: number;
  agentType: Agent;
  status: string;
  timestamp: string;
  preview: string;
  fullLogUrl: string; // Presigned S3 URL
  logEntries: LogEntry[];
  contentSize: number;
  expirationDate: string;
}
```

## Implementation Phases

### Phase 1: Database Schema
- Add JobLog, LogEntry, LogStorage models to Prisma schema
- Create and run migration
- Add TypeScript interfaces

### Phase 2: Log Capture Service
- Implement log capture in job status update endpoint
- Add log processing and normalization
- Implement S3 storage integration
- Add error handling and retries

### Phase 3: Log Retrieval Service
- Implement log retrieval API endpoint
- Add S3 presigned URL generation
- Implement caching for frequent access
- Add access control validation

### Phase 4: UI Integration
- Extend jobs-timeline.tsx with log viewing
- Create log display modal component
- Implement log fetching with TanStack Query
- Add loading and error states

### Phase 5: Log Pruning Service
- Implement scheduled pruning job
- Add soft delete functionality
- Implement cleanup validation
- Add monitoring and alerts
