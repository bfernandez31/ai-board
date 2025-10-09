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
- 016-create-github-actions: Added YAML (GitHub Actions Workflow Syntax 2.0), Shell (Bash 5.x)
- 014-add-github-branch: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Prisma 6.x (ORM), Zod 4.x (validation), Next.js 15 (App Router)
- 013-add-job-model: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Prisma 6.x (ORM), Zod 4.x (validation), Next.js 15 (App Router), PostgreSQL 14+

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

<!-- MANUAL ADDITIONS END -->
