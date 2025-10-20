# Database Migration Instructions

**Migration File**: `prisma/migrations/20251020214320_add_ticket_attachments/migration.sql`
**Status**: ⏸️ Ready to apply (requires DATABASE_URL)

## Quick Start

### Option 1: Use Existing Database (Recommended)

If you already have a PostgreSQL database running (likely since the project has existing migrations):

```bash
# 1. Ensure DATABASE_URL is in .env.local
# It should look like:
# DATABASE_URL="postgresql://user:password@localhost:5432/ai-board"

# 2. Apply the migration
npx prisma migrate dev

# 3. Verify the migration
npx prisma studio
# Check that Ticket table has new 'attachments' column
```

### Option 2: Set Up New Local Database

If you need to set up a PostgreSQL database from scratch:

```bash
# 1. Install PostgreSQL (if not already installed)
# macOS:
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian:
sudo apt-get install postgresql-14
sudo systemctl start postgresql

# 2. Create database
createdb ai-board

# 3. Add DATABASE_URL to .env.local
echo 'DATABASE_URL="postgresql://$(whoami)@localhost:5432/ai-board"' >> .env.local

# 4. Apply all migrations (including the new one)
npx prisma migrate dev

# 5. Verify
npx prisma studio
```

### Option 3: Use Docker

If you prefer Docker for development:

```bash
# 1. Start PostgreSQL container
docker run --name ai-board-postgres \
  -e POSTGRES_USER=aiboard \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=ai_board_dev \
  -p 5432:5432 \
  -d postgres:14

# 2. Add DATABASE_URL to .env.local
echo 'DATABASE_URL="postgresql://aiboard:devpassword@localhost:5432/ai_board_dev"' >> .env.local

# 3. Apply migrations
npx prisma migrate dev

# 4. Verify
npx prisma studio
```

## Migration Details

### SQL Changes

The migration adds a single field to the Ticket table:

```sql
ALTER TABLE "Ticket" ADD COLUMN "attachments" JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN "Ticket"."attachments" IS 'JSON array of TicketAttachment objects (max 5 items)';
```

### Impact

- **Backward Compatible**: ✅ Yes (existing tickets get empty array `[]`)
- **Data Loss Risk**: ✅ None (only adds new field)
- **Downtime Required**: ✅ No (fast migration, <1 second)
- **Rollback Available**: ✅ Yes (DROP COLUMN command in migration.sql comments)

### Prisma Schema Change

```prisma
model Ticket {
  // ... existing fields ...
  attachments Json? @default("[]")  // NEW
  // ... existing relations ...
}
```

## Verification Steps

After applying the migration:

### 1. Check Migration Status
```bash
npx prisma migrate status
# Should show: All migrations have been applied
```

### 2. Inspect Database Schema
```bash
npx prisma db pull
# Verify Prisma schema matches database
```

### 3. Open Prisma Studio
```bash
npx prisma studio
# Navigate to Ticket table
# Verify 'attachments' column exists with JSONB type
```

### 4. Test Prisma Client
```bash
# In Node REPL or a test file
npx tsx
```

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Test reading tickets with new field
const tickets = await prisma.ticket.findMany({ take: 1 });
console.log(tickets[0]?.attachments); // Should show [] or null
```

## Troubleshooting

### Error: "Environment variable not found: DATABASE_URL"

**Cause**: DATABASE_URL not set in .env.local

**Solution**:
1. Copy from .env.example: `cp .env.example .env.local`
2. Edit .env.local and set your actual database credentials
3. Retry migration

### Error: "Can't reach database server"

**Cause**: PostgreSQL is not running or connection details are incorrect

**Solution**:
```bash
# Check if PostgreSQL is running
# macOS:
brew services list | grep postgresql

# Linux:
systemctl status postgresql

# Start if needed:
brew services start postgresql@14  # macOS
sudo systemctl start postgresql    # Linux
```

### Error: "Migration failed to apply"

**Cause**: Database may already have the column or be in inconsistent state

**Solution**:
```bash
# Check migration history
npx prisma migrate status

# If migration is partially applied:
npx prisma migrate resolve --applied 20251020214320_add_ticket_attachments

# If you need to rollback and retry:
npx prisma migrate resolve --rolled-back 20251020214320_add_ticket_attachments
npx prisma migrate dev
```

### Manual Rollback (if needed)

If you need to undo the migration:

```sql
-- Connect to database
psql $DATABASE_URL

-- Drop the column
ALTER TABLE "Ticket" DROP COLUMN "attachments";

-- Mark migration as rolled back
-- (run from project root)
npx prisma migrate resolve --rolled-back 20251020214320_add_ticket_attachments
```

## Next Steps After Migration

Once the migration is successfully applied:

1. ✅ **Run Unit Tests**: `npm run test:unit` (should all pass)
2. ✅ **Continue Implementation**: Proceed to User Story 1 (T012-T022)
3. ✅ **Integration Tests**: Add API tests for image upload endpoints
4. ✅ **E2E Tests**: Test full user flows with image attachments

## References

- **Prisma Migration Guide**: https://www.prisma.io/docs/concepts/components/prisma-migrate
- **PostgreSQL Installation**: https://www.postgresql.org/download/
- **Docker PostgreSQL**: https://hub.docker.com/_/postgres
- **Project Quickstart**: `specs/038-image-support-spec/quickstart.md`
