# Tasks: Basic Kanban Board with 6 Columns

**Feature**: 002-create-a-basic
**Prerequisites**: research.md, data-model.md, contracts/tickets-api.yaml, quickstart.md

## Execution Flow (main)
```
1. Load research.md → Tech stack: Next.js 15, Prisma, PostgreSQL, shadcn/ui, Zod, date-fns
2. Load data-model.md → Entity: Ticket, Stage enum
3. Load contracts/tickets-api.yaml → 2 endpoints: GET /api/tickets, POST /api/tickets
4. Load quickstart.md → 7 test scenarios + performance validation
5. Generate tasks by category:
   → Setup: Prisma, shadcn/ui, dependencies
   → Tests: 2 contract tests, 7 E2E tests
   → Core: Prisma schema, API routes, UI components
   → Integration: Database connection, validation
   → Polish: Performance testing, responsiveness
6. Apply TDD principle: All tests before implementation
7. Mark parallel tasks [P] for independent file operations
8. Return: 23 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- File paths are relative to repository root

## Phase 3.1: Setup

- [x] T001 Install dependencies: @prisma/client, prisma, zod, date-fns
- [x] T002 Initialize shadcn/ui and add components: card, badge, scroll-area, skeleton
- [x] T003 Initialize Prisma with PostgreSQL and create prisma/schema.prisma
- [x] T004 Configure .env with DATABASE_URL for PostgreSQL connection
- [x] T005 Run initial Prisma migration to create Ticket table and Stage enum ✅ Migration: 20250930071746_init_tickets

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [ ] T006 [P] Contract test GET /api/tickets in tests/api/tickets-get.spec.ts
- [ ] T007 [P] Contract test POST /api/tickets in tests/api/tickets-post.spec.ts

### E2E Tests (User Scenarios from quickstart.md)
- [ ] T008 [P] E2E test: Empty board displays 6 columns with colors in tests/e2e/board-empty.spec.ts
- [ ] T009 [P] E2E test: Create ticket via API appears in IDLE column in tests/e2e/ticket-create.spec.ts
- [ ] T010 [P] E2E test: Ticket card displays title, ID, badge, timestamp in tests/e2e/ticket-card.spec.ts
- [ ] T011 [P] E2E test: Multiple tickets display with correct sorting in tests/e2e/board-multiple.spec.ts
- [ ] T012 [P] E2E test: Error handling for invalid ticket creation in tests/e2e/ticket-errors.spec.ts
- [ ] T013 [P] E2E test: Responsive design with horizontal scroll <375px in tests/e2e/board-responsive.spec.ts
- [ ] T014 [P] E2E test: Long title truncation at 2 lines in tests/e2e/ticket-truncation.spec.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database & Validation
- [ ] T015 Create Ticket model in prisma/schema.prisma with Stage enum and indexes
- [ ] T016 [P] Create Zod validation schemas in lib/validations/ticket.ts
- [ ] T017 [P] Create TypeScript type definitions in lib/types.ts
- [ ] T018 [P] Create database access functions in lib/db/tickets.ts (getTicketsByStage, createTicket)
- [ ] T019 [P] Create Prisma client singleton in lib/db/client.ts

### API Routes
- [ ] T020 Implement GET /api/tickets route handler in app/api/tickets/route.ts
- [ ] T021 Implement POST /api/tickets route handler in app/api/tickets/route.ts (add to same file)

### UI Components
- [ ] T022 [P] Create stage config and utilities in lib/utils/stage.ts
- [ ] T023 [P] Create timestamp formatting utility in lib/utils/time.ts
- [ ] T024 [P] Create TicketCard client component in components/board/ticket-card.tsx
- [ ] T025 [P] Create Column server component in components/board/column.tsx
- [ ] T026 Create Board server component in components/board/board.tsx
- [ ] T027 Create board page in app/board/page.tsx

## Phase 3.4: Integration

- [ ] T028 Generate Prisma client and verify database connection
- [ ] T029 Test API integration: Verify GET /api/tickets returns grouped tickets
- [ ] T030 Test API integration: Verify POST /api/tickets creates ticket in IDLE stage
- [ ] T031 Test UI integration: Verify board page fetches and displays tickets

## Phase 3.5: Polish

- [ ] T032 [P] Performance test: Verify 100 tickets load <2s, render <500ms in tests/performance/board-load.spec.ts
- [ ] T033 Run full Playwright test suite and verify all tests pass
- [ ] T034 Run TypeScript type checking with npm run type-check
- [ ] T035 Run linting with npm run lint and fix any issues
- [ ] T036 Test all quickstart.md scenarios manually and document results

## Dependencies

```
Setup (T001-T005)
  ↓
Tests (T006-T014) [All parallel, must fail]
  ↓
Database Layer (T015, T019)
  ↓
Validation & Types (T016-T017) [Parallel]
  ↓
Database Functions (T018)
  ↓
API Routes (T020-T021)
  ↓
Utilities (T022-T023) [Parallel]
  ↓
UI Components (T024-T025) [Parallel]
  ↓
Board Component & Page (T026-T027)
  ↓
Integration Testing (T028-T031)
  ↓
Polish (T032-T036)
```

## Parallel Execution Examples

### Phase 3.2 - Contract Tests (Run Together)
```bash
# Launch all contract tests in parallel:
npx playwright test tests/api/tickets-get.spec.ts tests/api/tickets-post.spec.ts
```

### Phase 3.2 - E2E Tests (Run Together)
```bash
# Launch all E2E tests in parallel:
npx playwright test tests/e2e/
```

### Phase 3.3 - Validation & Types (Run Together)
```bash
# T016, T017, T018, T019 can be created simultaneously
# Each writes to a different file
```

### Phase 3.3 - UI Components (Run Together)
```bash
# T022, T023, T024, T025 can be created simultaneously
# Each writes to a different file
```

## Task Details

### T001: Install Dependencies
```bash
npm install @prisma/client date-fns zod
npm install -D prisma
```

### T002: Initialize shadcn/ui
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add card badge scroll-area skeleton
```

### T003: Initialize Prisma
```bash
npx prisma init
```
Creates `prisma/schema.prisma` with datasource and generator.

### T004: Configure Environment
Create `.env`:
```
DATABASE_URL="postgresql://localhost:5432/ai_board?schema=public"
```

### T005: Run Initial Migration
```bash
npx prisma migrate dev --name init-tickets
npx prisma generate
```

### T006-T007: Contract Tests
Validate API contracts from `contracts/tickets-api.yaml`:
- GET /api/tickets → Returns TicketsByStage
- POST /api/tickets → Creates ticket, returns 201

### T008-T014: E2E Tests
Implement user scenarios from `quickstart.md`:
- Empty board with 6 columns
- Ticket creation and display
- Card information display
- Multiple tickets with sorting
- Error handling
- Responsive design
- Title truncation

### T015: Prisma Schema
```prisma
enum Stage {
  IDLE
  PLAN
  BUILD
  REVIEW
  SHIPPED
  ERRORED
}

model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(500)
  description String?  @db.Text
  stage       Stage    @default(IDLE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
}
```

### T016: Validation Schemas
Create Zod schemas for:
- CreateTicketInput (title, description)
- Ticket (full entity)
- Stage enum

### T017: Type Definitions
TypeScript types:
- Ticket (from Prisma)
- TicketsByStage
- CreateTicketResponse
- ErrorResponse
- Component props

### T018: Database Access Functions
Functions in `lib/db/tickets.ts`:
- `getTicketsByStage()` → TicketsByStage
- `createTicket(input)` → Ticket

### T019: Prisma Client Singleton
Singleton pattern to avoid multiple Prisma Client instances in development.

### T020-T021: API Route Handlers
Implement REST endpoints in `app/api/tickets/route.ts`:
- GET handler: Fetch all tickets grouped by stage
- POST handler: Validate input, create ticket, return 201

### T022: Stage Configuration
`lib/utils/stage.ts`:
- STAGE_CONFIG with labels, colors, descriptions
- Helper functions for stage metadata

### T023: Time Formatting
`lib/utils/time.ts`:
- formatTimestamp(): Relative (<24h) or absolute (>=24h)

### T024: TicketCard Component
Client Component (`"use client"`):
- Display title (2 lines max), ID, badge, timestamp
- Hover/click visual feedback
- No navigation or modal

### T025: Column Component
Server Component:
- Display stage header with name and count
- ScrollArea for ticket cards
- Color-coded styling

### T026: Board Component
Server Component:
- Grid layout for 6 columns
- Pass tickets to Column components

### T027: Board Page
Server Component:
- Fetch tickets with `getTicketsByStage()`
- Render Board component

### T028-T031: Integration Tests
Verify end-to-end functionality:
- Database connection works
- API routes return correct data
- UI fetches and displays tickets

### T032: Performance Test
Playwright test:
- Create 100 tickets
- Measure GET /api/tickets response time (<200ms)
- Measure page load time (<2s)
- Measure render time (<500ms)

### T033-T036: Final Validation
- Run all tests
- Type checking
- Linting
- Manual quickstart validation

## Validation Checklist

- [x] All contract endpoints have tests (T006-T007 cover tickets-api.yaml)
- [x] All entities have model tasks (T015 creates Ticket model)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks are independent (different files, verified)
- [x] Each task specifies exact file path
- [x] No [P] task conflicts (verified no same-file modifications)

## Notes

- TDD: Tests T006-T014 MUST fail before implementation begins
- Database: PostgreSQL must be running before T005
- Parallel [P]: Can run simultaneously via Task agent or manual execution
- Commits: Commit after completing each phase
- Order: Strictly follow dependency graph for sequential tasks