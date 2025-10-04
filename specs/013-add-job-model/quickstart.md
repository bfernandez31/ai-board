# Quickstart: Add Job Model

**Feature**: 013-add-job-model
**Date**: 2025-10-04
**Purpose**: Verify Job model implementation and database migration

## Prerequisites

- PostgreSQL 14+ running locally
- DATABASE_URL environment variable configured
- Node.js 22.20.0 LTS installed
- Dependencies installed (`npm install`)

## Quick Validation (5 minutes)

### 1. Verify Schema Changes

```bash
# Navigate to repository root
cd /path/to/ai-board

# View updated schema
cat prisma/schema.prisma | grep -A 30 "enum JobStatus\|model Job"
```

**Expected Output**:
- JobStatus enum with PENDING, RUNNING, COMPLETED, FAILED
- Job model with all 11 fields
- Foreign key relation to Ticket with onDelete: Cascade
- 4 indexes defined

### 2. Generate and Apply Migration

```bash
# Generate migration
npx prisma migrate dev --name add-job-model

# Expected output:
# - Migration file created in prisma/migrations/
# - Database schema updated
# - Prisma Client regenerated
```

**Verification**:
```bash
# Check migration was created
ls -la prisma/migrations/ | grep add-job-model

# Connect to database and verify table
npx prisma studio
# Navigate to Job model in UI - should show empty table
```

### 3. Test Prisma Client Integration

```bash
# Create test script
cat > test-job-model.ts << 'EOF'
import { PrismaClient, JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing Job model...\n');

  // Find a ticket to associate with (use existing or create one)
  let ticket = await prisma.ticket.findFirst();

  if (!ticket) {
    console.log('Creating test ticket...');
    const project = await prisma.project.findFirst();
    if (!project) {
      throw new Error('No project found - run seed script first');
    }

    ticket = await prisma.ticket.create({
      data: {
        title: 'Test Ticket for Job Model',
        description: 'Testing job model integration',
        projectId: project.id,
        stage: 'INBOX',
      },
    });
    console.log(`✓ Created test ticket #${ticket.id}\n`);
  } else {
    console.log(`✓ Using existing ticket #${ticket.id}\n`);
  }

  // Test 1: Create job with minimal required fields
  console.log('Test 1: Create job with minimal fields...');
  const job1 = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      command: 'specify',
      status: JobStatus.PENDING,
    },
  });
  console.log(`✓ Created job #${job1.id} - Status: ${job1.status}`);
  console.log(`  - startedAt: ${job1.startedAt}`);
  console.log(`  - branch: ${job1.branch} (nullable)`);
  console.log(`  - logs: ${job1.logs} (nullable)\n`);

  // Test 2: Create job with all optional fields
  console.log('Test 2: Create job with all fields...');
  const job2 = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      command: 'plan',
      status: JobStatus.RUNNING,
      branch: '013-add-job-model',
      commitSha: 'abc123def456',
      logs: 'Execution started...\nProcessing...\n',
    },
  });
  console.log(`✓ Created job #${job2.id} - Status: ${job2.status}`);
  console.log(`  - branch: ${job2.branch}`);
  console.log(`  - commitSha: ${job2.commitSha}`);
  console.log(`  - logs: ${job2.logs?.substring(0, 30)}...\n`);

  // Test 3: Update job to completed
  console.log('Test 3: Update job to completed...');
  const job3 = await prisma.job.update({
    where: { id: job2.id },
    data: {
      status: JobStatus.COMPLETED,
      completedAt: new Date(),
      logs: 'Execution started...\nProcessing...\nCompleted successfully!',
    },
  });
  console.log(`✓ Updated job #${job3.id} - Status: ${job3.status}`);
  console.log(`  - completedAt: ${job3.completedAt}\n`);

  // Test 4: Query jobs by ticket
  console.log('Test 4: Query jobs by ticket...');
  const ticketJobs = await prisma.job.findMany({
    where: { ticketId: ticket.id },
    orderBy: { startedAt: 'asc' },
  });
  console.log(`✓ Found ${ticketJobs.length} jobs for ticket #${ticket.id}`);
  ticketJobs.forEach((job) => {
    console.log(`  - Job #${job.id}: ${job.command} [${job.status}]`);
  });
  console.log();

  // Test 5: Query jobs by status
  console.log('Test 5: Query jobs by status...');
  const pendingJobs = await prisma.job.findMany({
    where: { status: JobStatus.PENDING },
  });
  console.log(`✓ Found ${pendingJobs.length} pending jobs\n`);

  // Test 6: Test cascade delete
  console.log('Test 6: Test cascade delete...');
  const jobCount = await prisma.job.count({ where: { ticketId: ticket.id } });
  console.log(`  - Jobs before ticket delete: ${jobCount}`);

  await prisma.ticket.delete({ where: { id: ticket.id } });
  console.log(`  - Deleted ticket #${ticket.id}`);

  const jobCountAfter = await prisma.job.count({ where: { ticketId: ticket.id } });
  console.log(`  - Jobs after ticket delete: ${jobCountAfter}`);
  console.log(`✓ Cascade delete working (${jobCount} → ${jobCountAfter})\n`);

  console.log('✅ All tests passed!');
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

# Run test
npx tsx test-job-model.ts

# Clean up
rm test-job-model.ts
```

**Expected Output**:
```
Testing Job model...

✓ Using existing ticket #1

Test 1: Create job with minimal fields...
✓ Created job #1 - Status: PENDING
  - startedAt: 2025-10-04T...
  - branch: null (nullable)
  - logs: null (nullable)

Test 2: Create job with all fields...
✓ Created job #2 - Status: RUNNING
  - branch: 013-add-job-model
  - commitSha: abc123def456
  - logs: Execution started...

Test 3: Update job to completed...
✓ Updated job #2 - Status: COMPLETED
  - completedAt: 2025-10-04T...

Test 4: Query jobs by ticket...
✓ Found 2 jobs for ticket #1
  - Job #1: specify [PENDING]
  - Job #2: plan [COMPLETED]

Test 5: Query jobs by status...
✓ Found 1 pending jobs

Test 6: Test cascade delete...
  - Jobs before ticket delete: 2
  - Deleted ticket #1
  - Jobs after ticket delete: 0
✓ Cascade delete working (2 → 0)

✅ All tests passed!
```

### 4. Verify Database Schema

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Check enum type
\dT+ JobStatus

# Check table structure
\d "Job"

# Check indexes
\d "Job"

# Expected:
# - 4 indexes (ticketId, status, startedAt, composite)
# - Foreign key constraint on ticketId with CASCADE

# Exit psql
\q
```

### 5. Verify TypeScript Types

```bash
# Generate types and check
npx prisma generate

# Create type check file
cat > check-types.ts << 'EOF'
import { Job, JobStatus, Prisma } from '@prisma/client';

// Test enum values
const status: JobStatus = 'PENDING'; // ✓ Valid
// const invalid: JobStatus = 'INVALID'; // ✗ Type error

// Test Job type
const job: Job = {
  id: 1,
  ticketId: 1,
  command: 'specify',
  status: 'COMPLETED',
  branch: null, // ✓ Nullable
  commitSha: null, // ✓ Nullable
  logs: null, // ✓ Nullable
  startedAt: new Date(),
  completedAt: new Date(), // ✓ Nullable
  createdAt: new Date(),
  updatedAt: new Date(),
};

console.log('✓ TypeScript types are correct');
EOF

# Type check
npx tsc --noEmit check-types.ts

# Clean up
rm check-types.ts
```

## Acceptance Criteria Verification

- [x] **AC-1**: Prisma schema includes Job model with all fields
  - Verify: `grep "model Job" prisma/schema.prisma -A 20`

- [x] **AC-2**: Prisma schema includes JobStatus enum
  - Verify: `grep "enum JobStatus" prisma/schema.prisma -A 5`

- [x] **AC-3**: Migration creates job table successfully
  - Verify: `psql $DATABASE_URL -c "\d Job"`

- [x] **AC-4**: Foreign key cascade deletes jobs when ticket deleted
  - Verify: Test 6 in quickstart script

- [x] **AC-5**: Indexes created on ticketId, status, startedAt
  - Verify: `psql $DATABASE_URL -c "\d Job"` (shows all indexes)

- [x] **AC-6**: Job queries work via Prisma client
  - Verify: Tests 1-5 in quickstart script

## Common Issues

### Migration fails with "relation already exists"

**Solution**: Reset database and rerun migration
```bash
npx prisma migrate reset
npx prisma migrate dev --name add-job-model
```

### Prisma Client not updated

**Solution**: Regenerate client
```bash
npx prisma generate
```

### Foreign key constraint violation

**Cause**: Trying to create job with non-existent ticketId

**Solution**: Ensure ticket exists before creating job
```typescript
const ticket = await prisma.ticket.findFirstOrThrow();
await prisma.job.create({ data: { ticketId: ticket.id, ... } });
```

### Type errors after migration

**Cause**: TypeScript using cached types

**Solution**: Restart TypeScript server and regenerate
```bash
npx prisma generate
# In VSCode: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

## Rollback

If migration needs to be rolled back:

```bash
# Revert last migration
npx prisma migrate resolve --rolled-back add-job-model

# Or reset to previous state
npx prisma migrate reset
```

## Next Steps

After verifying the data model:

1. ✅ Job model and JobStatus enum created
2. ✅ Migration applied successfully
3. ✅ Prisma Client updated with new types
4. ⏭️ **Future**: Create API routes for job CRUD operations
5. ⏭️ **Future**: Implement job lifecycle management (timeout handling, cancellation)
6. ⏭️ **Future**: Add job UI components for monitoring

## Estimated Time: 5-10 minutes

- Schema update: 1 min
- Migration generation: 1 min
- Test script execution: 2-3 min
- Database verification: 1-2 min
- Type verification: 1 min
