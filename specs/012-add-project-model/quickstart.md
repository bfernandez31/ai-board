# Quickstart: Project Model Implementation

**Feature**: 012-add-project-model
**Date**: 2025-10-04

## Prerequisites

- PostgreSQL 14+ running locally or accessible via DATABASE_URL
- Node.js 22.20.0 LTS
- Environment variables configured in `.env.local`:
  ```env
  DATABASE_URL="postgresql://user:password@localhost:5432/aiboard"
  GITHUB_OWNER="your-github-username"
  GITHUB_REPO="your-repo-name"
  ```

## Quick Setup

### 1. Run Migrations
```bash
npx prisma migrate dev
```

Expected output:
```
✓ Prisma Migrate applied the migrations
✓ Generated Prisma Client
```

### 2. Seed Database
```bash
npm run db:seed
```

Expected output:
```
Created default project: {
  id: 1,
  name: 'ai-board',
  description: 'AI-powered project management board',
  githubOwner: 'your-github-username',
  githubRepo: 'your-repo-name',
  ...
}
Created 7 sample tickets for project
```

### 3. Verify Setup
```bash
npx prisma studio
```

Open browser to http://localhost:5555 and verify:
- ✅ Project table has one record with your GitHub details
- ✅ Ticket table has 7 records all with matching projectId

## Validation Tests

### Test Idempotency
Run seed again to verify it doesn't create duplicates:
```bash
npm run db:seed
```

Expected output:
```
Default project already exists: { id: 1, name: 'ai-board', ... }
Project already has 7 tickets
```

### Test Environment Validation
Temporarily remove GITHUB_OWNER from .env.local and run seed:
```bash
npm run db:seed
```

Expected output:
```
Error: GITHUB_OWNER and GITHUB_REPO environment variables are required
```

### Test Unique Constraint
Try to manually create duplicate project in Prisma Studio:
- Add new Project record with same githubOwner/githubRepo
- Click Save

Expected result:
```
Unique constraint failed on the fields: (`githubOwner`,`githubRepo`)
```

### Test Cascade Delete
Delete the project in Prisma Studio:
- Navigate to Project table
- Delete the project record
- Check Ticket table

Expected result:
```
All tickets with that projectId are automatically deleted
```

## TypeScript Usage

### Import Prisma Client
```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
```

### Find Project by Repository
```typescript
const project = await prisma.project.findUnique({
  where: {
    githubOwner_githubRepo: {
      githubOwner: "your-username",
      githubRepo: "your-repo"
    }
  }
});
```

### Get Project with Tickets
```typescript
const projectWithTickets = await prisma.project.findUnique({
  where: { id: 1 },
  include: { tickets: true }
});
```

### Create New Ticket (with projectId)
```typescript
const ticket = await prisma.ticket.create({
  data: {
    title: "New feature",
    description: "Implement new feature",
    stage: "INBOX",
    projectId: 1  // Must match existing project
  }
});
```

## Common Issues

### Issue: "Environment variable not found: DATABASE_URL"
**Solution**: Create `.env.local` file with DATABASE_URL

### Issue: "Can't reach database server"
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct

### Issue: "Unique constraint failed"
**Solution**: Project with same GitHub repo already exists, check existing projects

### Issue: "Foreign key constraint failed on projectId"
**Solution**: Ensure projectId references existing Project.id

## Next Steps

After completing quickstart:

1. ✅ Verify all seed tests pass
2. ✅ Confirm TypeScript types work (auto-completion in IDE)
3. ✅ Run E2E tests: `npm run test:e2e`
4. ✅ Review generated migration in `prisma/migrations/`
5. ✅ Understand cascade delete behavior for production use

## E2E Test Execution

Run the full test suite to validate:
```bash
npm run test:e2e
```

Expected tests:
- ✅ Seed creates default project
- ✅ Seed is idempotent (multiple runs safe)
- ✅ Unique constraint prevents duplicates
- ✅ Tickets associate with projects correctly
- ✅ Cascade delete removes related tickets

## Development Workflow

### Making Schema Changes
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive-name`
3. Update seed script if needed
4. Run `npm run db:seed` to test
5. Commit migration files

### Resetting Database (Development Only)
```bash
npx prisma migrate reset
```
This will:
- Drop database
- Apply all migrations
- Run seed script

**WARNING**: Never run this in production!

## Production Deployment

### Migration Deployment
```bash
npx prisma migrate deploy
```

Run this in CI/CD pipeline BEFORE deploying code changes.

### Seed in Production
Only run seed once during initial deployment:
```bash
npm run db:seed
```

Subsequent deploys should NOT run seed (data already exists).

## Rollback Strategy

If issues occur, rollback migration:
```bash
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

Then restore from database backup.

## Monitoring

Check project data health:
```sql
-- Count projects
SELECT COUNT(*) FROM "Project";

-- Verify no orphaned tickets
SELECT COUNT(*) FROM "Ticket"
WHERE "projectId" NOT IN (SELECT id FROM "Project");

-- Verify unique constraint
SELECT "githubOwner", "githubRepo", COUNT(*)
FROM "Project"
GROUP BY "githubOwner", "githubRepo"
HAVING COUNT(*) > 1;
```

All queries should return expected results (1 project, 0 orphans, 0 duplicates).
