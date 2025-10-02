# Quickstart: Basic Kanban Board

**Feature**: 002-create-a-basic
**Purpose**: Step-by-step guide to validate the kanban board implementation

## Prerequisites

- Node.js 22.20.0 LTS installed
- PostgreSQL 14+ installed and running
- Repository cloned and dependencies installed
- Database configured (`.env` file with `DATABASE_URL`)

## Setup Steps

### 1. Install Dependencies

```bash
# Install project dependencies
npm install

# Install additional dependencies for this feature
npm install @prisma/client date-fns zod
npm install -D prisma
```

### 2. Install shadcn/ui Components

```bash
# Initialize shadcn/ui (if not already done)
npx shadcn-ui@latest init

# Add required components
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add skeleton
```

### 3. Setup Database

```bash
# Create database (adjust for your PostgreSQL setup)
createdb ai_board

# Set environment variable
echo 'DATABASE_URL="postgresql://localhost:5432/ai_board?schema=public"' > .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init-tickets

# (Optional) Seed with test data
npx prisma db seed
```

### 4. Start Development Server

```bash
npm run dev
```

Server should be running at `http://localhost:3000`

## Feature Validation

### Test Scenario 1: View Empty Board

**User Story**: As a user, I want to see the board with 6 empty columns

**Steps**:
1. Navigate to `http://localhost:3000/board`
2. Observe the board layout

**Expected Results**:
- ✅ 6 columns displayed side-by-side with labels: IDLE, PLAN, BUILD, REVIEW, SHIPPED, ERRORED
- ✅ Each column header shows "0 tickets"
- ✅ Columns are color-coded:
  - IDLE: Gray
  - PLAN: Blue
  - BUILD: Green
  - REVIEW: Orange
  - SHIPPED: Purple
  - ERRORED: Red
- ✅ Dark theme applied
- ✅ Board is responsive (resize browser to test)

**How to Verify**:
```bash
# Run E2E test
npx playwright test tests/board.spec.ts -g "displays empty board"
```

### Test Scenario 2: Create Ticket via API

**User Story**: As a user, I want to create tickets that appear in the IDLE column

**Steps**:
1. Open terminal or API client (Postman/Insomnia)
2. Send POST request to create a ticket:

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login bug",
    "description": "Users cannot log in with email"
  }'
```

3. Verify response (status 201):
```json
{
  "id": 1,
  "title": "Fix login bug",
  "description": "Users cannot log in with email",
  "stage": "IDLE",
  "createdAt": "2025-09-30T14:30:00.000Z",
  "updatedAt": "2025-09-30T14:30:00.000Z"
}
```

4. Refresh the board page `http://localhost:3000/board`

**Expected Results**:
- ✅ API responds with 201 status code
- ✅ Response includes all ticket fields with auto-generated ID
- ✅ `stage` is "IDLE"
- ✅ `createdAt` and `updatedAt` timestamps are set
- ✅ Ticket appears in IDLE column on board page
- ✅ IDLE column header shows "1 ticket"

**How to Verify**:
```bash
# Run E2E test
npx playwright test tests/board.spec.ts -g "creates ticket via API"
```

### Test Scenario 3: Ticket Card Display

**User Story**: As a user, I want to see ticket information on cards

**Prerequisites**: At least one ticket exists (from Test Scenario 2)

**Steps**:
1. Navigate to `http://localhost:3000/board`
2. Locate the ticket card in the IDLE column
3. Inspect the card content

**Expected Results**:
- ✅ Card displays ticket title (truncated at 2 lines if long)
- ✅ Card displays ticket ID format: `#1`, `#2`, etc.
- ✅ Card displays status badge showing "IDLE"
- ✅ Card displays last updated timestamp:
  - Relative format if < 24 hours (e.g., "2 hours ago")
  - Absolute format if >= 24 hours (e.g., "2025-09-30 14:30")
- ✅ Card shows visual feedback on hover (cursor changes, subtle highlight)
- ✅ Card shows visual feedback on click (active state)
- ✅ No modal or navigation occurs on click (display-only)

**How to Verify**:
```bash
# Run E2E test
npx playwright test tests/board.spec.ts -g "displays ticket card information"
```

### Test Scenario 4: Multiple Tickets

**User Story**: As a user, I want to see multiple tickets organized by stage

**Steps**:
1. Create tickets in different stages (manually update via Prisma Studio for testing):

```bash
# Open Prisma Studio
npx prisma studio

# Create tickets and manually set different stages
```

OR use API and database update:
```bash
# Create multiple tickets
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/tickets \
    -H "Content-Type: application/json" \
    -d "{\"title\": \"Ticket $i\", \"description\": \"Test ticket $i\"}"
done
```

2. Navigate to `http://localhost:3000/board`

**Expected Results**:
- ✅ Multiple tickets display in IDLE column
- ✅ Tickets sorted by most recently updated first
- ✅ Column header shows correct ticket count
- ✅ Column is scrollable if tickets exceed viewport height
- ✅ Ticket cards maintain consistent height (title truncation works)

**How to Verify**:
```bash
# Run E2E test
npx playwright test tests/board.spec.ts -g "displays multiple tickets"
```

### Test Scenario 5: Error Handling

**User Story**: As a user, I want clear error messages when ticket creation fails

**Steps**:
1. Attempt to create ticket with invalid data:

```bash
# Missing title (should fail)
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{}'

# Title too long (should fail)
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"$(printf 'A%.0s' {1..600})\"}"
```

**Expected Results**:
- ✅ API responds with 400 status code for validation errors
- ✅ Error response includes descriptive message:
  ```json
  {
    "error": "Title is required",
    "code": "VALIDATION_ERROR"
  }
  ```
- ✅ Error message displayed in UI (if creation attempted via form - future enhancement)

**How to Verify**:
```bash
# Run E2E test
npx playwright test tests/board.spec.ts -g "handles creation errors"
```

### Test Scenario 6: Responsive Design

**User Story**: As a user, I want the board to work on mobile devices

**Steps**:
1. Navigate to `http://localhost:3000/board`
2. Resize browser window to different widths:
   - Desktop: 1024px+ (all columns visible)
   - Tablet: 768px-1023px (all columns with tight spacing)
   - Mobile: 375px-767px (horizontal scroll)
   - Small mobile: < 375px (horizontal scroll with min-width columns)

**Expected Results**:
- ✅ Desktop (>= 1024px): All 6 columns visible side-by-side
- ✅ Mobile (< 768px): Horizontal scroll enabled
- ✅ Small mobile (< 375px): Horizontal scroll, columns maintain minimum width
- ✅ Column headers remain visible during scroll
- ✅ Ticket cards remain readable at all sizes
- ✅ Touch scrolling works smoothly on mobile devices

**How to Verify**:
```bash
# Run E2E test with mobile viewport
npx playwright test tests/board.spec.ts -g "responsive design" --project=mobile
```

### Test Scenario 7: Long Title Truncation

**User Story**: As a user, I want long ticket titles to be truncated consistently

**Steps**:
1. Create ticket with very long title:

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "This is a very long ticket title that should definitely exceed two lines when displayed on the card and needs to be truncated with an ellipsis"
  }'
```

2. Navigate to `http://localhost:3000/board`
3. Locate the new ticket card

**Expected Results**:
- ✅ Title displays maximum 2 lines
- ✅ Ellipsis (...) appears at end if truncated
- ✅ Card height remains consistent with other cards
- ✅ Full title accessible via tooltip/hover (future enhancement)

**How to Verify**:
```bash
# Run E2E test
npx playwright test tests/board.spec.ts -g "truncates long titles"
```

## Performance Validation

### Load Test: 100 Tickets

**Steps**:
1. Generate 100 tickets:

```bash
# Create script: scripts/generate-tickets.ts
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/tickets \
    -H "Content-Type: application/json" \
    -d "{\"title\": \"Performance Test Ticket $i\"}" &
done
wait
```

2. Navigate to `http://localhost:3000/board`
3. Measure performance using browser DevTools:
   - Network tab: API response time
   - Performance tab: Page load time

**Expected Results**:
- ✅ GET `/api/tickets` responds in < 200ms
- ✅ Board page loads in < 2 seconds
- ✅ Board renders in < 500ms
- ✅ Scrolling remains smooth (60fps)
- ✅ No UI lag or stuttering

**How to Verify**:
```bash
# Run performance test
npx playwright test tests/board.spec.ts -g "handles 100 tickets" --trace on
```

## Troubleshooting

### Issue: Database Connection Error

**Symptom**: `PrismaClientInitializationError: Can't reach database server`

**Solution**:
1. Check PostgreSQL is running: `pg_isready`
2. Verify `DATABASE_URL` in `.env`
3. Test connection: `psql $DATABASE_URL`

### Issue: Prisma Client Not Generated

**Symptom**: `Cannot find module '@prisma/client'`

**Solution**:
```bash
npx prisma generate
```

### Issue: Migrations Failed

**Symptom**: Migration errors during `prisma migrate dev`

**Solution**:
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Re-run migrations
npx prisma migrate dev
```

### Issue: shadcn/ui Components Not Found

**Symptom**: `Module not found: Can't resolve '@/components/ui/card'`

**Solution**:
```bash
# Re-install shadcn/ui components
npx shadcn-ui@latest add card badge scroll-area skeleton
```

### Issue: Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

## Success Criteria

All test scenarios must pass before considering this feature complete:

- [x] Empty board displays with 6 columns and correct colors
- [x] Tickets can be created via API
- [x] Created tickets appear in IDLE column
- [x] Ticket cards display all required information (title, ID, badge, timestamp)
- [x] Title truncation works at 2 lines
- [x] Visual feedback on hover/click (no functional action)
- [x] Multiple tickets display and scroll correctly
- [x] Error handling provides clear messages
- [x] Responsive design works on mobile
- [x] Performance meets targets (100 tickets, <2s load, <500ms render)
- [x] All Playwright E2E tests pass

## Next Steps

After completing this quickstart:

1. Run full test suite: `npx playwright test`
2. Run type checking: `npm run type-check`
3. Run linting: `npm run lint`
4. Generate test report: `npx playwright show-report`
5. Document any issues or edge cases discovered
6. Proceed to `/tasks` command for detailed implementation tasks

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js 15 App Router](https://nextjs.org/docs/app)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Playwright Testing](https://playwright.dev)
- [Zod Validation](https://zod.dev)