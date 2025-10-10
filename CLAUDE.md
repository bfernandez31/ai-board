# ai-board Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-30

## Active Technologies
- TypeScript 5.x (strict mode), Node.js 22.20.0 LTS + Next.js 15, React 18, TailwindCSS 3.x, Playwright (001-initialize-the-ai)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, TailwindCSS 3.4, Prisma (to be added), shadcn/ui (to be added) (002-create-a-basic)
- PostgreSQL via Prisma ORM (database setup required) (002-create-a-basic)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, TailwindCSS 3.4, Prisma 6.x, Zod 4.x, shadcn/ui (003-add-new-ticket)
- PostgreSQL 14+ via Prisma ORM (003-add-new-ticket)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, @dnd-kit/core, @dnd-kit/sortable, Prisma 6.x, Zod 4.x, shadcn/ui (004-add-drag-and)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, shadcn/ui (Dialog component), Radix UI (005-add-ticket-detail)
- PostgreSQL 14+ via Prisma ORM (existing Ticket model) (005-add-ticket-detail)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, @dnd-kit/core, @dnd-kit/sortable, Zod 4.x, shadcn/ui (Radix UI) (006-specify-add-specify)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, shadcn/ui (Radix UI), @dnd-ki (007-enable-inline-editing)
- PostgreSQL 14+ via Prisma ORM (existing Ticket model with version field) (007-enable-inline-editing)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, PostgreSQL 14+ (010-add-required-projectid)
- PostgreSQL 14+ via Prisma ORM with existing Project and Ticket models (010-add-required-projectid)
- PostgreSQL 14+ via Prisma ORM (existing Project and Ticket models) (011-refactor-routes-and)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Prisma 6.x (ORM), Zod 4.x (validation), Next.js 15 (App Router) (012-add-project-model)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Prisma 6.x (ORM), Zod 4.x (validation), Next.js 15 (App Router), PostgreSQL 14+ (013-add-job-model)
- PostgreSQL 14+ via Prisma ORM with existing Ticket model relation (013-add-job-model)
- YAML (GitHub Actions Workflow Syntax 2.0), Shell (Bash 5.x) (016-create-github-actions)
- N/A (workflow operates on repository files) (016-create-github-actions)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Playwright (testing), Prisma 6.x (ORM), Next.js 15 (App Router) (017-il-faudrait-modifier)
- PostgreSQL 14+ via Prisma (existing Project, Ticket, Job models) (018-add-github-transition)
- TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), Prisma 6.x, Zod 4.x, PostgreSQL 14+ (019-update-job-on)
- PostgreSQL via Prisma ORM (existing Job model to be extended) (019-update-job-on)

## Project Structure
```
backend/
frontend/
tests/
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
TypeScript 5.x (strict mode), Node.js 22.20.0 LTS: Follow standard conventions

## Recent Changes
- 019-update-job-on: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), Prisma 6.x, Zod 4.x, PostgreSQL 14+
- 018-add-github-transition: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
- 017-il-faudrait-modifier: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Playwright (testing), Prisma 6.x (ORM), Next.js 15 (App Router)

<!-- MANUAL ADDITIONS START -->

## Data Model Notes

### Ticket Model
The Ticket model includes the following fields for GitHub branch tracking and automation:

- **`branch`** (String?, max 200 chars): Tracks the Git branch associated with the ticket
  - Nullable field, defaults to `null` for new tickets
  - Updated via PATCH `/api/projects/:projectId/tickets/:id` or specialized `/branch` endpoint
  - Max length: 200 characters (validated at schema and API level)

- **`autoMode`** (Boolean): Enables automatic workflow progression for the ticket
  - Defaults to `false` for new tickets
  - Updated via PATCH `/api/projects/:projectId/tickets/:id`

## API Endpoints

### Ticket Branch Management

**PATCH `/api/projects/:projectId/tickets/:id/branch`**
- Specialized endpoint for updating ticket branch without version control
- Request body: `{ branch: string | null }`
- Response: `{ id, branch, updatedAt }` (minimal response)
- Validation: Branch max length 200 characters
- Does NOT use optimistic concurrency control (no version checking)

**PATCH `/api/projects/:projectId/tickets/:id`**
- General update endpoint supporting all ticket fields
- Now accepts `branch` and `autoMode` fields
- Uses optimistic concurrency control with version field
- Request body: `{ title?, description?, stage?, branch?, autoMode?, version }`
- Response: Full ticket object including new fields

**Note**: The `/branch` endpoint is designed for workflow automation scripts and does not increment the version field, while the general PATCH endpoint uses version-based conflict detection.

## Validation Rules

### Ticket Title and Description

The ticket validation schema allows the following characters:
- Letters: `a-z`, `A-Z`
- Numbers: `0-9`
- Spaces
- Special characters: `. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`

This allows for test prefixes like `[e2e]` and other common formatting needs while preventing emojis and control characters.

## E2E Test Data Isolation

### Test Data Prefix Convention

All E2E test-generated data MUST use the `[e2e]` prefix pattern to enable selective cleanup and data isolation:

**Ticket Creation Pattern**:
```typescript
await createTicket(request, {
  title: '[e2e] Fix login bug',  // ← [e2e] prefix mandatory
  description: 'Test description',
})
```

**Project Creation Pattern** (in `tests/helpers/db-cleanup.ts`):
```typescript
await client.project.upsert({
  where: { id: 1 },
  update: {},
  create: {
    id: 1,
    name: '[e2e] Test Project',  // ← [e2e] prefix mandatory
    ...
  }
})
```

### Selective Cleanup

The `cleanupDatabase()` function in `tests/helpers/db-cleanup.ts` performs selective deletion:
- **Tickets**: Deletes only tickets with `title` starting with `[e2e]`
- **Projects**: Deletes only projects with `name` starting with `[e2e]` AND `id` NOT IN (1, 2)
  - **Important**: Projects 1 & 2 are NEVER deleted to avoid cascade deletion of tickets
  - These projects are stable test fixtures, created once with `[e2e]` prefix
- **Manual Data**: All data without `[e2e]` prefix is preserved

**Usage**:
```typescript
test.beforeEach(async () => {
  await cleanupDatabase()  // Selective cleanup, preserves non-test data
})
```

### Best Practices for Test Creation

1. Always prefix test data: `title: '[e2e] Your Test Title'`
2. Use `beforeEach` cleanup pattern for test isolation
3. Assume clean database state at test start (no leftover test data)
4. Use deterministic project IDs (1, 2) for consistency
5. Never create data without `[e2e]` prefix in automated tests

<!-- MANUAL ADDITIONS END -->
