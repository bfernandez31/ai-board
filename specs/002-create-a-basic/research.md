# Research: Basic Kanban Board with 6 Columns

**Feature**: 002-create-a-basic
**Date**: 2025-09-30
**Phase**: 0 - Research & Technical Decisions

## Overview
Research findings for implementing a visual kanban board with 6 workflow columns using Next.js 15, React 18, and TypeScript. This document resolves technical unknowns and establishes implementation patterns.

## Technology Decisions

### 1. Database: Prisma + PostgreSQL

**Decision**: Use Prisma ORM with PostgreSQL for ticket persistence

**Rationale**:
- Type-safe database queries align with TypeScript-first principle
- Automatic migration system ensures database integrity (Constitution V)
- Prevents SQL injection through parameterized queries (Constitution IV)
- Schema-level constraints enforce data integrity
- Excellent Next.js 15 integration and App Router support

**Alternatives Considered**:
- MongoDB: Rejected due to lack of relational constraints and schema enforcement
- Raw SQL: Rejected due to SQL injection risk and manual type management overhead
- SQLite: Rejected for production scalability (PostgreSQL preferred for Vercel deployment)

**Implementation Pattern**:
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(500)
  description String?  @db.Text
  stage       Stage    @default(IDLE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Stage {
  IDLE
  PLAN
  BUILD
  REVIEW
  SHIPPED
  ERRORED
}
```

### 2. UI Components: shadcn/ui

**Decision**: Use shadcn/ui for UI primitives (Card, Badge, Button)

**Rationale**:
- Required by Constitution II (Component-Driven Architecture)
- Accessible by default (WCAG 2.1 AA compliance)
- Customizable with TailwindCSS (dark theme requirement)
- No runtime overhead (components copied to project)
- Radix UI primitives provide solid foundation

**Components Needed**:
- `Card` (for ticket cards)
- `Badge` (for status badges)
- `ScrollArea` (for column scrolling)
- `Skeleton` (for loading states)

**Installation**:
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add card badge scroll-area skeleton
```

### 3. Input Validation: Zod

**Decision**: Use Zod for runtime type validation and API input validation

**Rationale**:
- Type-safe validation aligns with TypeScript-first principle
- Runtime validation prevents invalid data entry (Constitution IV)
- Automatic TypeScript type inference from schemas
- Excellent integration with Prisma and tRPC (future)

**Validation Schema**:
```typescript
import { z } from 'zod';

export const CreateTicketSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
});

export const TicketStageSchema = z.enum([
  'IDLE', 'PLAN', 'BUILD', 'REVIEW', 'SHIPPED', 'ERRORED'
]);
```

### 4. Date Formatting: date-fns

**Decision**: Use date-fns for relative/absolute timestamp formatting

**Rationale**:
- Lightweight (tree-shakeable)
- TypeScript-native
- Supports relative time ("2 hours ago") and absolute formatting
- No timezone complexity for MVP (local time sufficient)

**Usage Pattern**:
```typescript
import { formatDistanceToNow, format } from 'date-fns';

export function formatTimestamp(date: Date): string {
  const hoursSince = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hoursSince < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, 'yyyy-MM-dd HH:mm');
}
```

### 5. API Design: REST with Next.js Route Handlers

**Decision**: Use Next.js App Router API routes with REST conventions

**Rationale**:
- Native Next.js 15 support (no additional setup)
- Follows Constitution II (Next.js conventions)
- Simple CRUD operations don't require GraphQL complexity
- Type-safe with TypeScript

**Endpoints**:
- `GET /api/tickets` - List all tickets grouped by stage
- `POST /api/tickets` - Create new ticket (returns created ticket)

**Response Format**:
```typescript
// GET /api/tickets
{
  IDLE: Ticket[],
  PLAN: Ticket[],
  BUILD: Ticket[],
  REVIEW: Ticket[],
  SHIPPED: Ticket[],
  ERRORED: Ticket[]
}

// POST /api/tickets
{
  id: number,
  title: string,
  description: string | null,
  stage: 'IDLE',
  createdAt: string,
  updatedAt: string
}

// Error response
{
  error: string,
  code?: string
}
```

### 6. State Management: React Server Components + Client Components

**Decision**: Server Components by default, Client Components only for user interactions

**Rationale**:
- Required by Constitution II (Server Components by default)
- Reduces JavaScript bundle size
- Fetches data on server (faster initial load)
- Client Components only for interactive ticket card hover states

**Architecture**:
- `app/board/page.tsx` - Server Component (fetches tickets)
- `components/board/board.tsx` - Server Component (renders layout)
- `components/board/column.tsx` - Server Component (renders column)
- `components/board/ticket-card.tsx` - Client Component (hover/click interactions)

### 7. Styling: TailwindCSS with Dark Theme

**Decision**: TailwindCSS utility classes with dark mode enabled

**Rationale**:
- Already configured in project
- Rapid development for responsive design
- Dark theme requirement (FR-005)
- Consistent with shadcn/ui components

**Color Scheme** (Stage colors from FR-003):
```typescript
const stageColors = {
  IDLE: 'bg-gray-500',    // Gray
  PLAN: 'bg-blue-500',    // Blue
  BUILD: 'bg-green-500',  // Green
  REVIEW: 'bg-orange-500',// Orange
  SHIPPED: 'bg-purple-500',// Purple
  ERRORED: 'bg-red-500'   // Red
};
```

### 8. Testing: Playwright E2E Tests

**Decision**: Playwright E2E tests before implementation (TDD)

**Rationale**:
- Required by Constitution III (Test-Driven Development)
- Already configured in project (Playwright 1.48)
- Tests user-facing behavior (not implementation details)
- Cross-browser testing capability

**Test Coverage**:
1. Board displays 6 empty columns with correct headers and colors
2. Board displays tickets in correct columns when data exists
3. Ticket cards show title (truncated at 2 lines), ID, badge, timestamp
4. Ticket creation via API appears immediately in IDLE column
5. Error handling: creation failure shows error message with retry
6. Responsive: horizontal scroll on screens < 375px
7. Visual feedback: ticket card hover/active states

## Performance Considerations

### Database Query Optimization
- Single query fetches all tickets with index on `stage` column
- Group by stage in application layer (simple mapping)
- No N+1 queries (Prisma includes relationships efficiently)

### Frontend Rendering Optimization
- Server Component renders initial state (no hydration delay)
- Client Component only for interactive cards (minimal JavaScript)
- CSS Grid for column layout (hardware accelerated)
- Virtual scrolling NOT needed for 100 tickets (premature optimization)

### Bundle Size Optimization
- shadcn/ui components tree-shaken automatically
- date-fns tree-shakeable (import only needed functions)
- No heavy dependencies in this phase

## Security Considerations

### Input Validation
- Zod validation on all API inputs
- Prisma prevents SQL injection
- XSS prevention: React auto-escapes by default
- Title length limit: 500 chars (prevents DOS via large inputs)
- Description length limit: 5000 chars

### Database Security
- Connection string in `.env` (not committed)
- Prisma migrations reviewed before production
- No raw SQL queries (parameterized only)

## Accessibility Considerations

### shadcn/ui Built-in Accessibility
- Semantic HTML from Radix UI primitives
- Keyboard navigation support
- ARIA attributes for screen readers
- Focus management

### Custom Accessibility Additions
- Column headers use `<h2>` for screen reader navigation
- Ticket cards use `<article>` semantic element
- Status badges use `aria-label` for context
- Color not sole indicator (text + color for stage)

## Mobile Responsiveness Strategy

### Breakpoints
- Desktop: >= 1024px (6 columns side-by-side, ~170px each)
- Tablet: 768px-1023px (6 columns with tight spacing)
- Mobile: 375px-767px (6 columns with horizontal scroll)
- Small mobile: < 375px (horizontal scroll, columns maintain min-width)

### Implementation
```css
.board-container {
  display: grid;
  grid-template-columns: repeat(6, minmax(280px, 1fr));
  gap: 1rem;
  overflow-x: auto;
}

@media (max-width: 768px) {
  .board-container {
    grid-template-columns: repeat(6, 280px);
  }
}
```

## Remaining Design Decisions (Addressed)

### Column Height
**Decision**: Fixed height with internal scroll

**Rationale**:
- Maintains board overview (all column headers visible)
- Prevents excessive page scrolling
- Standard kanban board pattern

**Implementation**: `max-height: calc(100vh - 200px)` with `overflow-y: auto`

### Ticket Sorting Within Columns
**Decision**: Sort by `updatedAt DESC` (most recently updated first)

**Rationale**:
- Keeps active tickets visible
- Simple implementation (Prisma orderBy)
- Aligns with workflow (recent activity = higher priority)

### Empty Column Placeholder
**Decision**: No placeholder text, just empty scrollable area

**Rationale**:
- Clean design (less visual noise)
- Header shows "0 tickets" (sufficient indication)
- Empty state obvious from lack of cards

### Ticket ID Format
**Decision**: Auto-incrementing integer displayed as `#1`, `#2`, etc.

**Rationale**:
- Simple implementation (Prisma @default(autoincrement()))
- Human-readable for small scale
- Sequential IDs provide creation order context
- Future: Can add prefix for multi-board support (`BOARD-1`)

### Ticket Count Update
**Decision**: Update on page refresh/revalidation (no real-time)

**Rationale**:
- Aligns with non-goals (no real-time updates in this phase)
- Server Component revalidation on navigation
- Sufficient for single-user MVP
- Future: Add optimistic updates or polling

## Dependencies to Install

```json
{
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "@radix-ui/react-scroll-area": "^1.1.0",
    "date-fns": "^3.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "prisma": "^5.20.0"
  }
}
```

## Environment Variables Required

```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/ai_board?schema=public"
```

## Phase 0 Completion Checklist

- [x] Database technology selected and justified (Prisma + PostgreSQL)
- [x] UI component library selected and justified (shadcn/ui)
- [x] Input validation approach defined (Zod)
- [x] Date formatting approach defined (date-fns)
- [x] API design pattern established (REST + Next.js Route Handlers)
- [x] State management strategy defined (Server Components + Client Components)
- [x] Styling approach confirmed (TailwindCSS dark theme)
- [x] Testing strategy confirmed (Playwright E2E)
- [x] Performance considerations documented
- [x] Security considerations documented
- [x] Accessibility considerations documented
- [x] Mobile responsiveness strategy defined
- [x] All remaining design decisions resolved
- [x] Dependencies list created
- [x] Environment variables documented

**Status**: ✅ Phase 0 Complete - Ready for Phase 1 (Design & Contracts)