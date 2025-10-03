# Quickstart: Refactor Routes and APIs to Require Project Context

**Feature**: 011-refactor-routes-and
**Purpose**: Validate feature implementation works end-to-end
**Target Audience**: Developers, QA testers

---

## Prerequisites

1. ✅ PostgreSQL database running
2. ✅ Environment variables configured (.env file)
3. ✅ Dependencies installed (`npm install`)
4. ✅ Database migrated (`npx prisma migrate dev`)
5. ✅ At least one project exists in database (ID: 1)

---

## Quick Validation Steps

### Step 1: Start Development Server
```bash
npm run dev
```
Expected: Server starts on http://localhost:3000

---

### Step 2: Test Root Redirect
```bash
# Navigate to root URL
open http://localhost:3000
```

**Expected Behavior**:
- ✅ Browser redirects to `/projects/1/board`
- ✅ URL bar shows `http://localhost:3000/projects/1/board`
- ✅ Board page loads with project 1's tickets

**Failure Modes**:
- ❌ 404 error → Check if project ID 1 exists in database
- ❌ No redirect → Check `app/page.tsx` implementation
- ❌ Blank page → Check browser console for errors

---

### Step 3: Test Project-Scoped Board Access
```bash
# Navigate directly to project board
open http://localhost:3000/projects/1/board
```

**Expected Behavior**:
- ✅ Board loads successfully
- ✅ Only tickets from project 1 are displayed
- ✅ All stages (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP) are visible

**Validation**:
1. Open browser DevTools → Network tab
2. Check request to `/api/projects/1/tickets`
3. Verify response contains only tickets with `projectId: 1`

**Failure Modes**:
- ❌ 404 error → Check route file exists at `app/projects/[projectId]/board/page.tsx`
- ❌ API 404 → Check API route exists at `app/api/projects/[projectId]/tickets/route.ts`
- ❌ Wrong tickets displayed → Check database query filters by `projectId`

---

### Step 4: Test Invalid Project ID
```bash
# Try accessing non-existent project
open http://localhost:3000/projects/999999/board
```

**Expected Behavior**:
- ✅ Returns 404 error page OR error message
- ✅ No tickets displayed
- ❌ Should NOT crash the application

**Failure Modes**:
- ❌ 500 error → Check project validation logic
- ❌ Shows tickets from other projects → CRITICAL BUG: Cross-project leak!

---

### Step 5: Test Create Ticket (Project-Scoped)
```bash
# On /projects/1/board, click "New Ticket" button
# Fill form:
Title: "Test project scoping"
Description: "Verify ticket is created in correct project"
# Submit form
```

**Expected Behavior**:
1. ✅ Modal opens with form
2. ✅ Form submits successfully
3. ✅ New ticket appears in INBOX column
4. ✅ Network tab shows POST to `/api/projects/1/tickets`
5. ✅ Created ticket has `projectId: 1` (verify in database or API response)

**Validation**:
```bash
# Check database
psql -d aiboard -c "SELECT id, title, projectId FROM \"Ticket\" ORDER BY id DESC LIMIT 1;"
```
Expected output shows `projectId: 1`

**Failure Modes**:
- ❌ Modal doesn't open → Check component props
- ❌ Wrong API endpoint called → Check client component fetch URL
- ❌ Ticket created with wrong projectId → CRITICAL BUG

---

### Step 6: Test Ticket Update (Project-Scoped)
```bash
# Drag a ticket from INBOX to SPECIFY
```

**Expected Behavior**:
1. ✅ Ticket moves to SPECIFY column optimistically
2. ✅ Network tab shows PATCH to `/api/projects/1/tickets/{id}`
3. ✅ Update succeeds (200 OK)
4. ✅ Ticket stays in SPECIFY column after page refresh

**Validation**:
```bash
# Refresh page
open http://localhost:3000/projects/1/board
```
Expected: Ticket remains in SPECIFY column

**Failure Modes**:
- ❌ Ticket reverts to INBOX → API update failed
- ❌ 403 error → Check projectId validation logic
- ❌ Wrong API endpoint → Check API URL in drag-and-drop handler

---

### Step 7: Test Cross-Project Access Prevention
This requires two projects in the database.

**Setup**:
```bash
# Create second project (if not exists)
psql -d aiboard -c "INSERT INTO \"Project\" (name, description, \"githubOwner\", \"githubRepo\", \"createdAt\", \"updatedAt\") VALUES ('Test Project 2', 'Test', 'test', 'test2', NOW(), NOW()) ON CONFLICT DO NOTHING;"

# Create ticket in project 2
psql -d aiboard -c "INSERT INTO \"Ticket\" (title, description, stage, version, \"projectId\", \"createdAt\", \"updatedAt\") VALUES ('Ticket in project 2', 'Test', 'INBOX', 1, 2, NOW(), NOW());"
```

**Test**:
```bash
# Get ticket ID from project 2
psql -d aiboard -c "SELECT id FROM \"Ticket\" WHERE \"projectId\" = 2 LIMIT 1;"
# Note the ID (e.g., 99)

# Try accessing via project 1's board
curl -X PATCH http://localhost:3000/api/projects/1/tickets/99 \
  -H "Content-Type: application/json" \
  -d '{"stage": "SPECIFY", "version": 1}'
```

**Expected Behavior**:
- ✅ Returns **403 Forbidden** (not 200)
- ✅ Ticket stage does NOT change in database

**Validation**:
```bash
# Verify ticket unchanged
psql -d aiboard -c "SELECT stage FROM \"Ticket\" WHERE id = 99;"
```
Expected: Still `INBOX`

**Failure Modes**:
- ❌ Returns 200 OK → CRITICAL SECURITY BUG: Cross-project access allowed!
- ❌ Returns 404 → Incorrect error code (should be 403)

---

### Step 8: Test API Contracts
```bash
# Run contract tests
npx playwright test tests/api/projects-tickets-get.spec.ts
npx playwright test tests/api/projects-tickets-post.spec.ts
npx playwright test tests/api/projects-tickets-patch.spec.ts
```

**Expected Behavior**:
- ✅ All tests pass
- ✅ No flaky tests
- ✅ Coverage for all error scenarios (400, 403, 404, 409)

**Failure Modes**:
- ❌ Tests fail → Check implementation matches contract specification
- ❌ Tests skipped → Test files may not exist yet (expected if TDD not followed)

---

### Step 9: Test E2E Flows
```bash
# Run full E2E test suite
npx playwright test tests/e2e/project-routing.spec.ts
npx playwright test tests/e2e/project-validation.spec.ts
```

**Expected Behavior**:
- ✅ All E2E scenarios pass
- ✅ Tests cover: root redirect, board access, ticket creation, cross-project prevention

**Failure Modes**:
- ❌ Tests fail → Check error messages for specific failures

---

## Manual Testing Checklist

Use this checklist for thorough manual validation:

### Routing
- [ ] Root `/` redirects to `/projects/1/board`
- [ ] `/projects/1/board` loads successfully
- [ ] `/projects/999/board` returns 404 or error
- [ ] `/projects/abc/board` returns 404 or error
- [ ] Browser back button works correctly after redirect

### API - GET Tickets
- [ ] GET `/api/projects/1/tickets` returns tickets from project 1 only
- [ ] GET `/api/projects/999/tickets` returns 404
- [ ] GET `/api/projects/abc/tickets` returns 400

### API - POST Ticket
- [ ] POST `/api/projects/1/tickets` creates ticket in project 1
- [ ] Created ticket has `projectId: 1`
- [ ] POST `/api/projects/999/tickets` returns 404
- [ ] POST with invalid data returns 400

### API - PATCH Ticket
- [ ] PATCH `/api/projects/1/tickets/{id}` updates ticket in project 1
- [ ] PATCH with wrong projectId returns 403
- [ ] PATCH non-existent ticket returns 404
- [ ] PATCH with version conflict returns 409

### UI - Board
- [ ] Board displays only tickets from current project
- [ ] Create ticket button works
- [ ] Drag-and-drop updates ticket stage
- [ ] Inline edit updates title/description
- [ ] All updates use project-scoped API endpoints

---

## Performance Validation

### Page Load Time
```bash
# Measure time to first meaningful paint
# Open DevTools → Lighthouse → Run audit
```
**Target**: <200ms for /projects/1/board

### API Response Time
```bash
# Check Network tab in DevTools
```
**Targets**:
- GET `/api/projects/1/tickets`: <100ms
- POST `/api/projects/1/tickets`: <150ms
- PATCH `/api/projects/1/tickets/{id}`: <100ms

### Database Query Count
```bash
# Enable Prisma query logging in .env
DATABASE_URL="postgresql://...?connection_limit=1&pool_timeout=0"

# Watch logs while loading board
npm run dev
# Open /projects/1/board
# Check console for query count
```
**Target**: <5 queries per page load

---

## Troubleshooting

### "Project not found" error
```bash
# Check if project 1 exists
psql -d aiboard -c "SELECT * FROM \"Project\" WHERE id = 1;"

# If not, create it
psql -d aiboard -c "INSERT INTO \"Project\" (id, name, description, \"githubOwner\", \"githubRepo\", \"createdAt\", \"updatedAt\") VALUES (1, 'Default Project', 'Default project for ai-board', 'default', 'default', NOW(), NOW()) ON CONFLICT DO NOTHING;"
```

### "Invalid project ID" error
- Check URL format: Must be `/projects/{number}/board`
- Check API endpoint: Must be `/api/projects/{number}/tickets`

### Cross-project access allowed (CRITICAL)
If tickets from other projects are visible or modifiable:
1. Check database query includes `WHERE projectId = ?`
2. Check API validation logic
3. Run: `psql -d aiboard -c "SELECT id, title, projectId FROM \"Ticket\";"`
4. Verify each ticket's `projectId` matches URL project

### Tests fail with "route not found"
- Verify file structure matches plan.md
- Check for typos in folder names (case-sensitive)
- Ensure `[projectId]` uses square brackets, not curly braces

---

## Success Criteria

This feature is complete when:

1. ✅ All routes use `/projects/{projectId}` prefix
2. ✅ All APIs use `/api/projects/{projectId}` prefix
3. ✅ Root redirects to default project
4. ✅ Invalid projects return 404
5. ✅ Cross-project access returns 403
6. ✅ All existing tests pass with new routes
7. ✅ New tests validate project scoping
8. ✅ Performance targets met

---

## Next Steps After Validation

Once quickstart passes:
1. Update all existing tests to use new routes
2. Remove old `/board` and `/api/tickets` routes
3. Update documentation with new URL structure
4. Deploy to staging environment
5. Monitor for errors

---

**Last Updated**: 2025-10-03
**Status**: ✅ Quickstart defined, ready for implementation validation
