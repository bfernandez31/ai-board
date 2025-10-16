# Quickstart: Branch Link in Ticket Details

**Feature**: 033-link-to-branch
**Developer**: Reference guide for implementing branch link feature
**Date**: 2025-10-16

## Overview

Add a GitHub branch link to ticket detail modal that appears when the ticket has an associated branch, opens GitHub in a new tab, and hides when ticket reaches SHIP stage.

---

## Prerequisites

- [ ] Read `spec.md` for functional requirements
- [ ] Read `research.md` for technical decisions
- [ ] Read `data-model.md` to understand existing data structures
- [ ] Verify local development environment is running

---

## Implementation Steps

### Step 1: Search for Existing Tests (TDD Workflow)

**CRITICAL**: Follow constitution's Test Discovery Workflow before writing any tests.

```bash
# Search for existing ticket detail modal tests
npx grep -r "ticket.*detail" tests/

# Search for ticket-related test files
npx glob "tests/**/*ticket*.spec.ts"

# Check for existing branch link tests
npx grep -r "branch.*link\|github.*link" tests/
```

**Decision Tree**:
- **If tests found**: Open existing test file and add new test cases
- **If no tests found**: Create new test file `/tests/e2e/ticket-detail-modal.spec.ts`

---

### Step 2: Write Failing E2E Tests (Red Phase)

Create or extend test file: `/tests/e2e/ticket-detail-modal.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Branch Link in Ticket Detail Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Create ticket with branch
    await setupTicketWithBranch(page, {
      branch: '033-test-branch',
      stage: 'BUILD',
      githubOwner: 'testorg',
      githubRepo: 'testrepo',
    });
  });

  test('displays branch link when branch exists and stage is not SHIP', async ({ page }) => {
    await openTicketDetail(page, ticketId);

    const branchLink = page.getByRole('link', { name: /view in github/i });
    await expect(branchLink).toBeVisible();
    await expect(branchLink).toHaveAttribute(
      'href',
      'https://github.com/testorg/testrepo/tree/033-test-branch'
    );
  });

  test('opens GitHub in new tab when clicked', async ({ page, context }) => {
    await openTicketDetail(page, ticketId);

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: /view in github/i }).click()
    ]);

    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('github.com');
    expect(newPage.url()).toContain('/tree/033-test-branch');
  });

  test('hides branch link when branch is null', async ({ page }) => {
    await setupTicketWithBranch(page, { branch: null });
    await openTicketDetail(page, ticketId);

    const branchLink = page.getByRole('link', { name: /view in github/i });
    await expect(branchLink).not.toBeVisible();
  });

  test('hides branch link when stage is SHIP', async ({ page }) => {
    await setupTicketWithBranch(page, {
      branch: '033-test-branch',
      stage: 'SHIP'
    });
    await openTicketDetail(page, ticketId);

    const branchLink = page.getByRole('link', { name: /view in github/i });
    await expect(branchLink).not.toBeVisible();
  });

  test('encodes branch names with special characters', async ({ page }) => {
    await setupTicketWithBranch(page, {
      branch: 'feature/login page'  // Space and slash
    });
    await openTicketDetail(page, ticketId);

    const branchLink = page.getByRole('link', { name: /view in github/i });
    await expect(branchLink).toHaveAttribute(
      'href',
      'https://github.com/testorg/testrepo/tree/feature%2Flogin%20page'
    );
  });
});
```

**Run tests** (should fail - Red phase):
```bash
npx playwright test tests/e2e/ticket-detail-modal.spec.ts
```

---

### Step 3: Implement Feature (Green Phase)

#### 3.1: Add Helper Function

**File**: `/components/board/ticket-detail-modal.tsx`
**Location**: Before component definition (~line 90)

```typescript
/**
 * Constructs GitHub branch URL with proper encoding
 * @param owner - GitHub repository owner/organization
 * @param repo - GitHub repository name
 * @param branch - Git branch name (will be URL encoded)
 * @returns Fully qualified GitHub branch tree URL
 */
const buildGitHubBranchUrl = (
  owner: string,
  repo: string,
  branch: string
): string => {
  return `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branch)}`;
};
```

#### 3.2: Add Icon Import

**File**: `/components/board/ticket-detail-modal.tsx`
**Location**: Line 5 (with other lucide-react imports)

```typescript
import { Pencil, FileText, Settings2, GitBranch } from 'lucide-react';
```

#### 3.3: Add Branch Link Rendering

**File**: `/components/board/ticket-detail-modal.tsx`
**Location**: After "View Specification" button section (~line 836), before "Dates section" (~line 839)

```typescript
{/* Branch link - show when branch exists and stage is not SHIP */}
{localTicket?.branch &&
 localTicket.stage !== 'SHIP' &&
 localTicket.project?.githubOwner &&
 localTicket.project?.githubRepo && (
  <div className="border-t-2 border-[#313244]/50 pt-6">
    <a
      href={buildGitHubBranchUrl(
        localTicket.project.githubOwner,
        localTicket.project.githubRepo,
        localTicket.branch
      )}
      target="_blank"
      rel="noopener noreferrer"
      className="
        w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium py-3
        flex items-center justify-center gap-2 rounded-md
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-2 focus:ring-offset-[#181825]
      "
      data-testid="github-branch-link"
      aria-label={`View branch ${localTicket.branch} in GitHub`}
    >
      <GitBranch className="w-5 h-5" aria-hidden="true" />
      <span>View in GitHub</span>
    </a>
  </div>
)}
```

#### 3.4: Verify TypeScript Compilation

```bash
npm run type-check
# OR
npx tsc --noEmit
```

**Expected**: No TypeScript errors (all types already exist in TicketData interface)

---

### Step 4: Run Tests (Green Phase)

```bash
# Run E2E tests
npx playwright test tests/e2e/ticket-detail-modal.spec.ts

# Run all tests
npm test
```

**Expected**: All tests pass ✅

---

### Step 5: Manual Testing

#### Test Case 1: Branch Link Visible (BUILD stage)

1. Start dev server: `npm run dev`
2. Navigate to project board
3. Create ticket or select existing ticket
4. Transition ticket to BUILD stage (if not already)
5. Ensure ticket has branch value (via GitHub workflow or manual API call)
6. Open ticket detail modal
7. **Verify**: Branch link visible below description, styled consistently with "View Specification" button

#### Test Case 2: Branch Link Opens GitHub

1. Click branch link
2. **Verify**: New tab opens with GitHub branch page
3. **Verify**: URL matches pattern `https://github.com/{owner}/{repo}/tree/{branch}`

#### Test Case 3: Branch Link Hidden (SHIP stage)

1. Transition ticket to SHIP stage
2. Open ticket detail modal
3. **Verify**: Branch link not visible

#### Test Case 4: Branch Link Hidden (No Branch)

1. Create new ticket without branch value
2. Open ticket detail modal
3. **Verify**: Branch link not visible

#### Test Case 5: Special Characters in Branch Name

1. Create ticket with branch name containing spaces or slashes (e.g., `feature/login page`)
2. Open ticket detail modal
3. Click branch link
4. **Verify**: GitHub URL properly encodes special characters (`feature%2Flogin%20page`)

---

## Validation Checklist

### Code Quality
- [ ] TypeScript strict mode passes (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Prettier formatting applied (`npm run format`)
- [ ] No `any` types introduced
- [ ] No console.log statements left in code

### Accessibility
- [ ] Link has descriptive `aria-label`
- [ ] Icon has `aria-hidden="true"`
- [ ] Keyboard navigable (can tab to link and press Enter)
- [ ] Sufficient color contrast (Purple button on dark background)
- [ ] Screen reader announces link purpose

### Security
- [ ] Uses `rel="noopener noreferrer"` on external link
- [ ] Branch name URL-encoded via `encodeURIComponent()`
- [ ] No XSS vulnerabilities from user input

### Performance
- [ ] Conditional rendering (no unused DOM elements)
- [ ] No additional API calls
- [ ] Icon tree-shaken (only GitBranch imported)
- [ ] Bundle size impact < 2KB

### Tests
- [ ] E2E tests pass for all scenarios
- [ ] Tests follow existing test patterns
- [ ] Tests use `data-testid` for stable selectors
- [ ] Tests check both visibility and functionality

### UX
- [ ] Link styling consistent with existing buttons
- [ ] Visual hierarchy clear (branch link above dates, below description)
- [ ] Hover state provides visual feedback
- [ ] Link disappears smoothly when stage changes to SHIP

---

## Common Issues and Solutions

### Issue 1: "Cannot find module 'lucide-react'"

**Solution**:
```bash
npm install lucide-react
# OR verify it's in package.json
npm list lucide-react
```

### Issue 2: TypeScript error "Property 'githubOwner' does not exist on type Project"

**Solution**: Verify Project interface includes GitHub fields. Check Prisma schema:
```bash
npx prisma studio
# Navigate to Project model and verify fields exist
```

### Issue 3: Link not visible in dev environment

**Checklist**:
1. Verify ticket has `branch` value (not null/empty)
2. Verify ticket stage is not SHIP
3. Verify project has `githubOwner` and `githubRepo` values
4. Check browser console for errors

### Issue 4: Playwright tests fail with "element not found"

**Solution**: Add `await page.waitForSelector('[data-testid="github-branch-link"]')` before assertions

---

## File Checklist

### Files Modified
- [ ] `/components/board/ticket-detail-modal.tsx` (branch link rendering)

### Files Created or Extended
- [ ] `/tests/e2e/ticket-detail-modal.spec.ts` (E2E tests)

### Files Read (No Changes)
- `/components/ui/dialog.tsx` (shadcn/ui Dialog primitive)
- `/components/ui/button.tsx` (styling reference)
- `/prisma/schema.prisma` (verify existing fields)

---

## Performance Benchmarks

### Target Metrics
- **Render Time**: < 50ms for branch link to appear on modal render
- **Bundle Size Impact**: < 2KB (GitBranch icon only)
- **Network Impact**: 0 additional requests

### Measurement Commands
```bash
# Build and check bundle size
npm run build
npm run analyze  # If bundle analyzer configured

# Check component render performance in dev tools
# Chrome DevTools → Performance → Record → Open modal → Stop
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass locally
- [ ] TypeScript compilation succeeds
- [ ] ESLint and Prettier checks pass
- [ ] Manual testing completed for all scenarios
- [ ] No console errors in browser
- [ ] Accessibility audit passes (Chrome DevTools Lighthouse)

### Post-Deployment
- [ ] Verify feature works in staging environment
- [ ] Test with real GitHub repository URLs
- [ ] Verify link opens GitHub in new tab (production HTTPS)
- [ ] Monitor error logs for link-related issues
- [ ] Check analytics for branch link click-through rate (if tracked)

---

## Related Documentation

- **Specification**: [spec.md](./spec.md) - Functional requirements and success criteria
- **Research**: [research.md](./research.md) - Technical decisions and alternatives
- **Data Model**: [data-model.md](./data-model.md) - Database fields and relationships
- **Constitution**: [/.specify/memory/constitution.md](../.specify/memory/constitution.md) - Project coding standards
- **CLAUDE.md**: [/CLAUDE.md](../CLAUDE.md) - AI Board development guidelines

---

## Support and Questions

### Common Questions

**Q: Why use anchor tag instead of Next.js Link?**
A: Next.js Link is for internal navigation. External GitHub URLs should use standard anchor tags for proper browser handling and better accessibility.

**Q: Why hide link in SHIP stage?**
A: Assumption is that SHIP stage means "deployed and branch no longer needed." This can be revisited based on user feedback.

**Q: What if branch is deleted on GitHub?**
A: Link will still render but GitHub will show a 404 page. This is acceptable UX (GitHub handles the error gracefully).

**Q: Can we add branch metadata (last commit, author)?**
A: Out of scope for initial implementation. Can be added as enhancement based on user feedback. Would require GitHub API integration.

---

## Next Steps

After implementing this feature:

1. **Collect User Feedback**: Monitor usage and gather feedback on UX
2. **Consider Enhancements**:
   - Branch existence validation (GitHub API)
   - Pull request association
   - Branch metadata display (last commit, author)
3. **Analytics**: Track branch link click-through rate
4. **Documentation**: Update user-facing docs if needed
