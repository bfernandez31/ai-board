# Quickstart: Display Generated Spec.md

**Feature**: 022-display-generated-spec
**Purpose**: Verify the complete user flow for viewing specification documents
**Estimated Time**: 5 minutes

## Prerequisites

1. **Development server running**:
   ```bash
   npm run dev
   ```

2. **Database seeded with test data**:
   ```bash
   npm run db:seed
   ```

3. **Test environment configured**:
   - GITHUB_TOKEN set to "test" or "placeholder" (test mode)
   - Or GITHUB_TOKEN unset (test mode)
   - Database accessible at DATABASE_URL

## Test Scenario: Happy Path

### Step 1: Create Test Ticket with Completed Specify Job

**Goal**: Set up a ticket that meets all conditions for spec viewing

**Actions**:
```typescript
// Via Prisma Studio or seed script
const ticket = await prisma.ticket.create({
  data: {
    id: 999,
    title: '[quickstart] Test Spec Viewer',
    description: 'Test ticket for quickstart guide',
    stage: 'SPECIFY',
    branch: 'quickstart-test-branch',
    projectId: 1, // Test project
  },
});

const job = await prisma.job.create({
  data: {
    ticketId: 999,
    command: 'specify',
    status: 'COMPLETED',
    completedAt: new Date(),
  },
});
```

**Expected Result**:
- Ticket 999 exists in project 1
- Has branch "quickstart-test-branch"
- Has completed "specify" job

### Step 2: Navigate to Board and Open Ticket

**Goal**: Verify ticket displays correctly on board

**Actions**:
1. Open browser to `http://localhost:3000/projects/1/board`
2. Find ticket "[quickstart] Test Spec Viewer" in SPECIFY column
3. Click on the ticket card

**Expected Result**:
- TicketDetailModal opens
- Shows ticket title, description, dates
- Shows "View Specification" button (blue button)

**Screenshot**:
```
┌────────────────────────────────────────┐
│ Ticket Details             [X]         │
├────────────────────────────────────────┤
│ Title: [quickstart] Test Spec Viewer   │
│ Description: Test ticket for quickstart│
│ Stage: SPECIFY                          │
│ Created: 2025-10-11                     │
│ Updated: 2025-10-11                     │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │     View Specification             │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### Step 3: Click "View Specification" Button

**Goal**: Verify API call and modal display

**Actions**:
1. Click "View Specification" button
2. Observe loading state (spinner)
3. Wait for content to load

**Expected Result**:
- Button shows loading state (disabled + spinner)
- Network tab shows: `GET /api/projects/1/tickets/999/spec`
- Response status: 200
- Response body:
  ```json
  {
    "content": "# Test Mode Specification\n\nThis is mock content...",
    "metadata": {
      "ticketId": 999,
      "branch": "quickstart-test-branch",
      "projectId": 1,
      "fileName": "spec.md",
      "filePath": "specs/quickstart-test-branch/spec.md"
    }
  }
  ```
- SpecViewer modal opens with rendered markdown

### Step 4: Verify Markdown Rendering

**Goal**: Ensure markdown displays correctly

**Actions**:
1. Observe modal header (ticket ID + title)
2. Scroll through markdown content
3. Check heading styles (h1, h2, h3)
4. Check code block syntax highlighting
5. Check list rendering

**Expected Result**:
- Modal header shows: "Specification - Ticket #999: [quickstart] Test Spec Viewer"
- Markdown renders with proper styles:
  - Headings have appropriate sizes and weights
  - Code blocks have dark background + syntax colors
  - Lists are properly indented
  - Links are styled (if any)
- Content is scrollable if exceeds viewport height
- Dark theme consistent with app

**Screenshot**:
```
┌──────────────────────────────────────────────┐
│ Specification - Ticket #999      [X]         │
├──────────────────────────────────────────────┤
│ ╭────────────────────────────────────────╮   │
│ │ # Test Mode Specification              │   │
│ │                                        │   │
│ │ This is mock content returned in test  │   │
│ │ mode.                                  │   │
│ │                                        │   │
│ │ ## Test Requirements                   │   │
│ │ - Test requirement 1                   │   │
│ │ - Test requirement 2                   │   │
│ │                                        │   │
│ │ ```typescript                          │   │
│ │ const test = 'example';                │   │
│ │ ```                                    │   │
│ ╰────────────────────────────────────────╯   │
│                                              │
└──────────────────────────────────────────────┘
```

### Step 5: Close Modal

**Goal**: Verify modal closes correctly

**Actions**:
1. Click close button (X)
2. OR press ESC key

**Expected Result**:
- SpecViewer modal closes
- Returns to TicketDetailModal
- No errors in console

### Step 6: Test Button Visibility - No Branch

**Goal**: Verify button hides when branch is null

**Actions**:
```typescript
// Update ticket to remove branch
await prisma.ticket.update({
  where: { id: 999 },
  data: { branch: null },
});
```

1. Refresh page
2. Click ticket card

**Expected Result**:
- TicketDetailModal opens
- "View Specification" button is NOT visible

### Step 7: Test Button Visibility - No Completed Job

**Goal**: Verify button hides when no completed specify job

**Actions**:
```typescript
// Restore branch, update job to PENDING
await prisma.ticket.update({
  where: { id: 999 },
  data: { branch: 'quickstart-test-branch' },
});

await prisma.job.update({
  where: { id: job.id },
  data: { status: 'PENDING', completedAt: null },
});
```

1. Refresh page
2. Click ticket card

**Expected Result**:
- TicketDetailModal opens
- "View Specification" button is NOT visible

## Error Scenario Tests

### Test 8: Invalid Ticket ID

**Goal**: Verify 404 handling

**Actions**:
1. Manually call: `GET /api/projects/1/tickets/99999/spec`

**Expected Result**:
- Status: 404
- Response: `{ "error": "Ticket not found" }`
- Frontend shows error toast

### Test 9: Wrong Project

**Goal**: Verify 403 handling

**Actions**:
1. Create ticket in project 2
2. Try to access via project 1 URL

**Expected Result**:
- Status: 403
- Response: `{ "error": "Forbidden" }`
- Frontend shows error toast

### Test 10: GitHub API Error (Simulated)

**Goal**: Verify 500 handling

**Actions**:
1. Set GITHUB_TOKEN to actual token (disable test mode)
2. Use branch that doesn't exist in real repo

**Expected Result**:
- Status: 404 or 500
- Response: `{ "error": "Specification file not found" }`
- Frontend shows error toast

## Performance Validation

### Metrics to Verify

**API Response Time**:
```bash
# Test mode should be <50ms
curl -w "@curl-format.txt" -o /dev/null -s \
  "http://localhost:3000/api/projects/1/tickets/999/spec"
```

**Expected**: <50ms in test mode

**Frontend Render Time**:
- Open DevTools Performance tab
- Record while opening spec viewer
- Check "Markdown Render" timing

**Expected**: <100ms for typical specs

**Bundle Size**:
```bash
npm run build
# Check chunk size for spec-viewer component
```

**Expected**: <50KB for spec-viewer chunk

## Cleanup

**Remove test data**:
```typescript
await prisma.job.delete({ where: { id: job.id } });
await prisma.ticket.delete({ where: { id: 999 } });
```

## Success Criteria

✅ All 10 test scenarios pass
✅ API responses match contract
✅ UI displays correctly on desktop and mobile
✅ No console errors or warnings
✅ Performance metrics within targets
✅ Error handling works for all error codes

## Troubleshooting

**Button not showing**:
- Check ticket.branch is not null
- Check ticket has job with command='specify' and status='COMPLETED'
- Check browser console for errors

**API returns 404**:
- Verify ticket exists: `await prisma.ticket.findUnique({ where: { id: 999 } })`
- Verify project ID matches ticket.projectId

**Markdown not rendering**:
- Check browser console for react-markdown errors
- Verify content is valid markdown
- Check CSS styles are loaded

**Test mode not working**:
- Verify GITHUB_TOKEN is unset or contains "test"/"placeholder"
- Check environment variables loaded correctly

---

**Quickstart Complete**: Feature is working correctly if all steps pass.
**Next**: Run E2E tests with `npm run test:e2e`
