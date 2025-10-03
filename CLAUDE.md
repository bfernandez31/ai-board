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
- 011-refactor-routes-and: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, shadcn/ui
- 010-add-required-projectid: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, PostgreSQL 14+
- 007-enable-inline-editing: Added TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS + Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, shadcn/ui (Radix UI), @dnd-ki

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
