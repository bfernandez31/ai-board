# Quickstart: Projects List Page Validation

**Feature**: Projects List Page
**Date**: 2025-10-11
**Purpose**: Manual validation steps to verify feature implementation

## Prerequisites

Before starting validation:
- [ ] Development server running (`npm run dev`)
- [ ] Database seeded with test projects (use `/scripts/create-dev-project.ts` if needed)
- [ ] Browser with DevTools open (for inspecting network and console)

## Test Environment Setup

### Create Test Projects (if needed)

```bash
# Ensure at least 3 projects exist
npx tsx scripts/create-dev-project.ts

# Verify projects in database
npx prisma studio
# Navigate to Project table, verify 3+ projects exist
```

### Expected Test Data

You should have:
- **Project 1**: "AI Board Development" with tickets
- **Project 2**: Additional test project with tickets
- **Project 3**: Empty project (0 tickets) - optional

## Validation Scenarios

### Scenario 1: View Projects List (Happy Path)

**Steps**:
1. Navigate to `http://localhost:3000/projects`
2. Observe page loads without errors
3. Check console for warnings/errors (should be none)

**Expected Results**:
- [ ] Page displays without 404 error
- [ ] No console errors in DevTools
- [ ] Loading state brief (< 200ms) or not visible

**What to Look For**:
- Clean page render
- No React hydration warnings
- Network tab shows successful `GET /api/projects` request

---

### Scenario 2: Project Card Display

**Steps**:
1. On `/projects` page, inspect each project card
2. Verify all fields are visible and populated

**Expected Results** (for each project):
- [ ] Project name displayed (e.g., "AI Board Development")
- [ ] Project description displayed (full text, not truncated unless very long)
- [ ] "Last updated" timestamp displayed (human-readable format)
- [ ] Ticket count displayed (e.g., "15 tickets")

**What to Look For**:
- Text is readable (not cut off, appropriate font sizes)
- Layout is clean and modern
- Cards have visual hierarchy (title > description > metadata)

---

### Scenario 3: Hover Effect

**Steps**:
1. Hover mouse over a project card
2. Observe visual feedback
3. Move mouse away, observe return to normal state

**Expected Results**:
- [ ] Card scales up slightly on hover (appears larger)
- [ ] Cursor changes to pointer (`cursor: pointer`)
- [ ] Animation is smooth (no jank, 60fps)
- [ ] Card returns to normal size when hover ends

**What to Look For**:
- Smooth scale transition (~200ms duration)
- No layout shift in surrounding cards
- Transform is GPU-accelerated (check DevTools Performance tab)

---

### Scenario 4: Navigation to Board

**Steps**:
1. Click on a project card
2. Observe navigation occurs
3. Verify destination URL is correct

**Expected Results**:
- [ ] Clicking navigates to `/projects/{id}/board` (e.g., `/projects/3/board`)
- [ ] Navigation is instant (client-side routing, no full reload)
- [ ] Board page loads successfully
- [ ] Browser back button returns to projects list

**What to Look For**:
- No full page reload (check Network tab for lack of document request)
- URL matches project ID clicked
- Smooth transition (no flash of unstyled content)

---

### Scenario 5: Placeholder Buttons

**Steps**:
1. Locate "Import Project" and "Create Project" buttons at top of page
2. Inspect button styling and icons
3. Attempt to click buttons

**Expected Results**:
- [ ] "Import Project" button visible with icon + text
- [ ] "Create Project" button visible with icon + text
- [ ] Buttons appear styled but non-interactive (disabled state)
- [ ] Clicking buttons does nothing (no navigation, no console errors)

**What to Look For**:
- Icons properly aligned with text
- Disabled styling (e.g., reduced opacity, different cursor)
- Buttons present but clearly not functional

---

### Scenario 6: Empty State (Optional)

**Setup**: Remove all projects or use fresh database

**Steps**:
1. Clear all projects: `npx prisma studio` → Delete all Project records
2. Navigate to `http://localhost:3000/projects`
3. Observe empty state message

**Expected Results**:
- [ ] Empty state message displays: "No projects available"
- [ ] Call-to-action text mentions "Create Project" button
- [ ] No error thrown when projects array is empty
- [ ] Layout remains clean (centered message)

**What to Look For**:
- Helpful, non-error message
- Clear guidance to next action
- No broken layout or missing components

---

### Scenario 7: Large List (50+ Projects)

**Setup**: Seed database with 50+ projects (script or manual)

**Steps**:
1. Seed many projects (modify seed script temporarily)
2. Navigate to `/projects`
3. Scroll through project list

**Expected Results**:
- [ ] All projects render without performance degradation
- [ ] Scrolling is smooth (60fps)
- [ ] Container is scrollable (overflow-y-auto)
- [ ] No pagination controls (all projects visible via scroll)

**What to Look For**:
- Smooth scrolling performance
- No layout thrashing
- Scroll container has appropriate max height
- No horizontal scroll

---

### Scenario 8: API Contract Validation

**Steps**:
1. Open DevTools Network tab
2. Navigate to `/projects`
3. Inspect `GET /api/projects` request/response

**Expected Results**:
- [ ] Status: `200 OK`
- [ ] Response Content-Type: `application/json`
- [ ] Response body is array of objects
- [ ] Each object has: `id`, `name`, `description`, `updatedAt`, `ticketCount`
- [ ] No extra fields in response

**What to Look For**:
- Response matches OpenAPI contract (`contracts/get-projects.json`)
- TypeScript types match response shape
- No sensitive data exposed (e.g., githubOwner, githubRepo)

---

## Performance Validation

### Page Load Performance

**Steps**:
1. Open DevTools Performance tab
2. Reload `/projects` page
3. Record performance profile

**Expected Results**:
- [ ] First Contentful Paint (FCP): < 500ms
- [ ] Time to Interactive (TTI): < 1000ms
- [ ] Total page load: < 200ms (after API response)

**What to Look For**:
- Server Component benefits visible (reduced hydration)
- API request completes quickly (<50ms for ~10 projects)
- No unnecessary re-renders in React DevTools Profiler

---

## Rollback & Cleanup

After validation:
```bash
# Restore development project if modified
npx tsx scripts/create-dev-project.ts

# Reset test data if needed
npx prisma migrate reset --skip-seed
npx tsx scripts/create-dev-project.ts
```

---

## Pass/Fail Criteria

**PASS**: All checkboxes checked, no console errors, performance within targets
**FAIL**: Any scenario fails, console errors present, or performance issues observed

**If Fail**:
1. Document failing scenario
2. Check browser console for errors
3. Review Network tab for API issues
4. Verify implementation matches design docs

---

## Notes

- This quickstart validates feature behavior, not code quality
- E2E tests (`/tests/e2e/projects-list.spec.ts`) automate these scenarios
- Manual validation should be quick (<10 minutes)
- Focus on user-visible behavior, not implementation details

**Last Updated**: 2025-10-11
