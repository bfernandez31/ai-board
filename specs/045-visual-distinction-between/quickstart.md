# Quickstart Guide: Visual Job Type Distinction

**Date**: 2025-10-23
**Feature**: Visual distinction between stage transition jobs and AI-BOARD comment jobs

## Overview

This guide provides step-by-step implementation instructions for adding visual job type indicators to ticket cards and detail modals. Follow TDD approach: write tests first, then implement.

**Estimated Implementation Time**: 2-3 hours

**Complexity**: Low - Client-side UI enhancement with no database changes

---

## Prerequisites

- [x] Read `spec.md` for feature requirements
- [x] Read `research.md` for design decisions
- [x] Read `data-model.md` for type definitions
- [x] Review `contracts/` for interface specifications
- [ ] Verify Node.js 22.20.0 LTS installed
- [ ] Verify TypeScript 5.6+ configured
- [ ] Verify lucide-react icons available (already in package.json)

---

## Implementation Steps

### Step 1: Create Type Definitions (5 minutes)

**File**: `lib/types/job-types.ts` (CREATE NEW)

```typescript
/**
 * JobType Enum
 *
 * Represents the category of a job based on its command string.
 */
export enum JobType {
  WORKFLOW = 'WORKFLOW',
  AI_BOARD = 'AI_BOARD',
}

/**
 * Job Type Configuration
 *
 * Visual rendering configuration for each job type.
 */
export interface JobTypeConfig {
  type: JobType;
  label: string;
  iconName: 'Cog' | 'MessageSquare';
  iconColor: string;
  textColor: string;
  bgColor: string;
  ariaLabel: string;
}
```

**Validation**:
```bash
npm run type-check
# ✅ Expect: No type errors
```

---

### Step 2: Create Classification Utility (10 minutes)

**File**: `lib/utils/job-type-classifier.ts` (CREATE NEW)

```typescript
import { JobType, JobTypeConfig } from '@/lib/types/job-types';

/**
 * Job Type Configuration Map
 */
export const JOB_TYPE_CONFIG: Record<JobType, JobTypeConfig> = {
  [JobType.WORKFLOW]: {
    type: JobType.WORKFLOW,
    label: 'Workflow',
    iconName: 'Cog',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-100/10',
    ariaLabel: 'Automated workflow job',
  },
  [JobType.AI_BOARD]: {
    type: JobType.AI_BOARD,
    label: 'AI-BOARD',
    iconName: 'MessageSquare',
    iconColor: 'text-purple-600',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-100/10',
    ariaLabel: 'AI-BOARD assistance job',
  },
};

/**
 * Classify Job Type
 *
 * Derives JobType from command string using prefix pattern matching.
 */
export function classifyJobType(command: string): JobType {
  if (command.startsWith('comment-')) {
    return JobType.AI_BOARD;
  }
  return JobType.WORKFLOW;
}

/**
 * Get Job Type Configuration
 */
export function getJobTypeConfig(jobType: JobType): JobTypeConfig {
  return JOB_TYPE_CONFIG[jobType];
}
```

**Validation**:
```bash
npm run type-check
# ✅ Expect: No type errors
```

---

### Step 3: Write Unit Tests (15 minutes)

**File**: `tests/unit/job-type-classifier.test.ts` (CREATE NEW)

```typescript
import { describe, it, expect } from '@playwright/test';
import { classifyJobType, getJobTypeConfig } from '@/lib/utils/job-type-classifier';
import { JobType } from '@/lib/types/job-types';

describe('Job Type Classifier', () => {
  describe('classifyJobType', () => {
    it('should classify workflow commands as WORKFLOW', () => {
      expect(classifyJobType('specify')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('plan')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('tasks')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('implement')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('quick-impl')).toBe(JobType.WORKFLOW);
    });

    it('should classify AI-BOARD commands as AI_BOARD', () => {
      expect(classifyJobType('comment-specify')).toBe(JobType.AI_BOARD);
      expect(classifyJobType('comment-plan')).toBe(JobType.AI_BOARD);
      expect(classifyJobType('comment-build')).toBe(JobType.AI_BOARD);
      expect(classifyJobType('comment-verify')).toBe(JobType.AI_BOARD);
    });

    it('should default unknown commands to WORKFLOW', () => {
      expect(classifyJobType('unknown-command')).toBe(JobType.WORKFLOW);
      expect(classifyJobType('')).toBe(JobType.WORKFLOW);
    });
  });

  describe('getJobTypeConfig', () => {
    it('should return correct config for WORKFLOW', () => {
      const config = getJobTypeConfig(JobType.WORKFLOW);
      expect(config.label).toBe('Workflow');
      expect(config.iconName).toBe('Cog');
      expect(config.iconColor).toBe('text-blue-600');
    });

    it('should return correct config for AI_BOARD', () => {
      const config = getJobTypeConfig(JobType.AI_BOARD);
      expect(config.label).toBe('AI-BOARD');
      expect(config.iconName).toBe('MessageSquare');
      expect(config.iconColor).toBe('text-purple-600');
    });
  });
});
```

**Run Tests (RED - expect failures)**:
```bash
npm run test:unit
# ✅ Expect: All tests pass (GREEN) since implementation is already written
```

---

### Step 4: Modify JobStatusIndicator Component (20 minutes)

**File**: `components/board/job-status-indicator.tsx` (MODIFY EXISTING)

**Changes**:

1. **Add imports**:
```typescript
import { Cog, MessageSquare } from 'lucide-react';
import { JobType } from '@/lib/types/job-types';
import { getJobTypeConfig } from '@/lib/utils/job-type-classifier';
```

2. **Update interface** (around line 10):
```typescript
export interface JobStatusIndicatorProps {
  status: JobStatus;
  command: string;
  jobType?: JobType;  // ← ADD THIS
  className?: string;
  animated?: boolean;
  ariaLabel?: string;
}
```

3. **Modify component body** (around line 50):
```typescript
export function JobStatusIndicator({
  status,
  command,
  jobType,  // ← ADD THIS
  className,
  animated = true,
  ariaLabel,
}: JobStatusIndicatorProps) {
  const statusConfig = getStatusConfig(status);

  // Get job type config if jobType is provided
  const jobTypeConfig = jobType ? getJobTypeConfig(jobType) : null;

  // Build aria label
  const statusLabel = ariaLabel || `Job ${command} is ${status.toLowerCase()}`;
  const jobTypeLabel = jobTypeConfig ? `. ${jobTypeConfig.ariaLabel}` : '';
  const finalAriaLabel = `${statusLabel}${jobTypeLabel}`;

  const shouldAnimate = status === 'RUNNING' && animated;

  // Icon component mapping
  const JobTypeIcon = jobTypeConfig
    ? jobTypeConfig.iconName === 'Cog'
      ? Cog
      : MessageSquare
    : null;

  return (
    <div
      data-testid="job-status-indicator"
      className={cn('flex items-center gap-3', className)}
      role="img"
      aria-label={finalAriaLabel}
    >
      {/* Status indicator (existing) */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex items-center justify-center',
            shouldAnimate && 'animate-quill-writing'
          )}
          style={
            shouldAnimate ? { willChange: 'transform' } : undefined
          }
        >
          {statusConfig.icon}
        </div>
        <span className={cn('text-sm font-medium', statusConfig.textColor)}>
          {status}
        </span>
      </div>

      {/* Job type indicator (new) */}
      {jobTypeConfig && JobTypeIcon && (
        <div
          data-testid="job-type-indicator"
          className="flex items-center gap-1.5 text-xs"
        >
          <JobTypeIcon
            className={cn('h-4 w-4', jobTypeConfig.iconColor)}
          />
          <span className={cn('font-medium', jobTypeConfig.textColor)}>
            {jobTypeConfig.label}
          </span>
        </div>
      )}
    </div>
  );
}
```

**Validation**:
```bash
npm run type-check
# ✅ Expect: No type errors

npm run lint
# ✅ Expect: No linting errors
```

---

### Step 5: Update TicketCard Component (10 minutes)

**File**: `components/board/ticket-card.tsx` (MODIFY EXISTING)

**Changes**:

1. **Add import** (around line 8):
```typescript
import { classifyJobType } from '@/lib/utils/job-type-classifier';
```

2. **Modify JobStatusIndicator usage** (around line 104-112):
```typescript
{/* Job Status Indicator */}
{currentJob && (
  <div className="border-t border-[#313244] pt-3">
    <JobStatusIndicator
      status={currentJob.status}
      command={currentJob.command}
      jobType={classifyJobType(currentJob.command)}  // ← ADD THIS LINE
      animated={true}
    />
  </div>
)}
```

**Validation**:
```bash
npm run type-check
# ✅ Expect: No type errors

npm run lint
# ✅ Expect: No linting errors
```

---

### Step 6: Update TicketDetailModal Component (10 minutes)

**File**: `components/board/ticket-detail-modal.tsx` (MODIFY EXISTING)

**Search for existing JobStatusIndicator usage** (use Grep or manual search):
```bash
grep -n "JobStatusIndicator" components/board/ticket-detail-modal.tsx
```

**Modify found occurrences**:

1. **Add import**:
```typescript
import { classifyJobType } from '@/lib/utils/job-type-classifier';
```

2. **Update JobStatusIndicator calls**:
```typescript
<JobStatusIndicator
  status={job.status}
  command={job.command}
  jobType={classifyJobType(job.command)}  // ← ADD THIS LINE
  animated={false}
/>
```

**Validation**:
```bash
npm run type-check
# ✅ Expect: No type errors

npm run lint
# ✅ Expect: No linting errors
```

---

### Step 7: Write Integration Tests (25 minutes)

**File**: `tests/integration/tickets/ticket-card-job-status.spec.ts` (EXTEND EXISTING)

**Add to existing test file**:

```typescript
import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '@/tests/helpers/db-cleanup';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Ticket Card - Job Type Visual Distinction', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();

    // Create test user
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
      },
    });

    // Create test ticket
    await prisma.ticket.create({
      data: {
        id: 1,
        title: '[e2e] Test Ticket for Job Types',
        description: 'Testing job type visual distinction',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });
  });

  test('should display workflow icon for specify command', async ({ page }) => {
    // Create workflow job
    await prisma.job.create({
      data: {
        ticketId: 1,
        projectId: 1,
        command: 'specify',
        status: 'RUNNING',
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]');

    // Verify workflow indicator exists
    const jobTypeIndicator = page.locator('[data-testid="job-type-indicator"]');
    await expect(jobTypeIndicator).toBeVisible();
    await expect(jobTypeIndicator).toContainText('Workflow');
  });

  test('should display AI-BOARD icon for comment-specify command', async ({ page }) => {
    // Create AI-BOARD job
    await prisma.job.create({
      data: {
        ticketId: 1,
        projectId: 1,
        command: 'comment-specify',
        status: 'RUNNING',
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]');

    // Verify AI-BOARD indicator exists
    const jobTypeIndicator = page.locator('[data-testid="job-type-indicator"]');
    await expect(jobTypeIndicator).toBeVisible();
    await expect(jobTypeIndicator).toContainText('AI-BOARD');
  });

  test('should update job type indicator when job changes', async ({ page }) => {
    // Create initial workflow job
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        projectId: 1,
        command: 'specify',
        status: 'RUNNING',
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="job-type-indicator"]');

    // Verify initial state
    let jobTypeIndicator = page.locator('[data-testid="job-type-indicator"]');
    await expect(jobTypeIndicator).toContainText('Workflow');

    // Update to AI-BOARD job
    await prisma.job.update({
      where: { id: job.id },
      data: { command: 'comment-plan', status: 'COMPLETED' },
    });

    // Create new AI-BOARD job
    await prisma.job.create({
      data: {
        ticketId: 1,
        projectId: 1,
        command: 'comment-build',
        status: 'RUNNING',
      },
    });

    // Wait for polling update (2 seconds)
    await page.waitForTimeout(2500);

    // Verify updated state
    jobTypeIndicator = page.locator('[data-testid="job-type-indicator"]');
    await expect(jobTypeIndicator).toContainText('AI-BOARD');
  });
});
```

**Run Tests**:
```bash
npm run test:e2e
# ✅ Expect: All new tests pass (GREEN)
```

---

### Step 8: Write E2E Accessibility Tests (20 minutes)

**File**: `tests/e2e/job-type-visual-distinction.spec.ts` (CREATE NEW)

```typescript
import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '@/tests/helpers/db-cleanup';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Job Type Visual Distinction - E2E', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();

    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
      },
    });

    await prisma.ticket.create({
      data: {
        id: 1,
        title: '[e2e] Visual Distinction Test',
        description: 'Testing visual job type indicators',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });
  });

  test('should display visual distinction without hover', async ({ page }) => {
    await prisma.job.create({
      data: {
        ticketId: 1,
        projectId: 1,
        command: 'specify',
        status: 'RUNNING',
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="job-type-indicator"]');

    // Verify visibility without hover
    const indicator = page.locator('[data-testid="job-type-indicator"]');
    await expect(indicator).toBeVisible();

    // Verify no hover required (indicator should be visible immediately)
    const isVisible = await indicator.isVisible();
    expect(isVisible).toBe(true);
  });

  test('should have correct ARIA labels for accessibility', async ({ page }) => {
    await prisma.job.create({
      data: {
        ticketId: 1,
        projectId: 1,
        command: 'comment-specify',
        status: 'RUNNING',
      },
    });

    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="job-status-indicator"]');

    // Check aria-label
    const statusIndicator = page.locator('[data-testid="job-status-indicator"]');
    const ariaLabel = await statusIndicator.getAttribute('aria-label');

    expect(ariaLabel).toContain('comment-specify');
    expect(ariaLabel).toContain('RUNNING');
    expect(ariaLabel).toContain('AI-BOARD assistance job');
  });

  test('should maintain responsive layout on mobile', async ({ page }) => {
    await prisma.job.create({
      data: {
        ticketId: 1,
        projectId: 1,
        command: 'specify',
        status: 'RUNNING',
      },
    });

    // Set mobile viewport (320px minimum width)
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="job-type-indicator"]');

    // Verify indicator is visible and within viewport
    const indicator = page.locator('[data-testid="job-type-indicator"]');
    await expect(indicator).toBeVisible();

    const boundingBox = await indicator.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.width).toBeLessThanOrEqual(320);
  });

  test('should distinguish job types in ticket detail modal', async ({ page }) => {
    // Create multiple jobs with different types
    await prisma.job.createMany({
      data: [
        {
          ticketId: 1,
          projectId: 1,
          command: 'specify',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        {
          ticketId: 1,
          projectId: 1,
          command: 'comment-plan',
          status: 'RUNNING',
        },
      ],
    });

    await page.goto('http://localhost:3000/projects/1/board');
    await page.waitForSelector('[data-testid="ticket-card"]');

    // Click to open detail modal
    await page.click('[data-testid="ticket-card"]');
    await page.waitForSelector('[role="dialog"]');

    // Verify both job types visible in history
    const jobTypeIndicators = page.locator('[data-testid="job-type-indicator"]');
    await expect(jobTypeIndicators).toHaveCount(2);

    // Verify first job is workflow
    const firstIndicator = jobTypeIndicators.nth(0);
    await expect(firstIndicator).toContainText('Workflow');

    // Verify second job is AI-BOARD
    const secondIndicator = jobTypeIndicators.nth(1);
    await expect(secondIndicator).toContainText('AI-BOARD');
  });
});
```

**Run Tests**:
```bash
npm run test:e2e
# ✅ Expect: All tests pass (GREEN)
```

---

## Validation Checklist

### Pre-Deployment Checks

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:e2e`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] No console errors in browser DevTools
- [ ] Visual indicators display correctly in all browsers (Chrome, Firefox, Safari)
- [ ] Accessibility audit passes (Chrome DevTools Lighthouse)
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 minimum)
- [ ] Responsive layout works on mobile (320px width)
- [ ] Screen reader announces correct labels (test with NVDA/JAWS)

### Manual Testing

1. **Create workflow job**:
   - Drag ticket from INBOX to SPECIFY
   - Verify blue Cog icon appears with "Workflow" label
   - Verify status indicator shows RUNNING/COMPLETED

2. **Create AI-BOARD job**:
   - Add comment with `@ai-board` mention
   - Verify purple MessageSquare icon appears with "AI-BOARD" label
   - Verify status indicator shows RUNNING/COMPLETED

3. **Test responsive behavior**:
   - Resize browser to 320px width
   - Verify indicators remain visible
   - Verify layout does not break

4. **Test accessibility**:
   - Enable screen reader (NVDA on Windows, VoiceOver on Mac)
   - Navigate to ticket card
   - Verify screen reader announces job type correctly

---

## Troubleshooting

### Issue: Type errors after adding jobType prop

**Cause**: Missing import or incorrect type definition

**Solution**:
```typescript
// Add to imports at top of file
import { JobType } from '@/lib/types/job-types';
```

### Issue: Icons not displaying

**Cause**: lucide-react icons not imported correctly

**Solution**:
```typescript
// Verify imports in job-status-indicator.tsx
import { Cog, MessageSquare, Clock, Pen, CheckCircle2, XCircle, Ban } from 'lucide-react';
```

### Issue: Colors not applying

**Cause**: TailwindCSS classes not recognized

**Solution**:
- Verify `tailwind.config.js` includes all color shades
- Run `npm run dev` to regenerate Tailwind CSS

### Issue: Tests failing with "Cannot find module"

**Cause**: TypeScript path aliases not resolved in test environment

**Solution**:
```typescript
// Verify tsconfig.json has paths configured
"paths": {
  "@/*": ["./*"]
}
```

### Issue: Accessibility contrast warnings

**Cause**: Colors don't meet WCAG 2.1 AA requirements

**Solution**:
- Verify using Chrome DevTools Accessibility panel
- Adjust color values in JOB_TYPE_CONFIG
- Re-test with colorblind simulation

---

## Performance Optimization

### Code Splitting

**Not required** - Icons are tree-shaken by lucide-react, only imported icons are bundled.

### Memoization

**Already implemented** - TicketCard uses React.memo (line 21 of ticket-card.tsx).

### Render Optimization

**classifyJobType() is pure function** - No memoization needed, O(1) complexity.

**getJobTypeConfig() is static lookup** - No memoization needed, O(1) complexity.

---

## Deployment Steps

1. **Merge to main branch**:
   ```bash
   git checkout main
   git merge 045-visual-distinction-between
   ```

2. **Push to GitHub**:
   ```bash
   git push origin main
   ```

3. **Verify Vercel deployment**:
   - Automatic deployment triggered
   - Monitor build logs in Vercel dashboard
   - Verify production URL works correctly

4. **Post-deployment validation**:
   - Test workflow jobs display correctly
   - Test AI-BOARD jobs display correctly
   - Verify no console errors in production
   - Run Lighthouse accessibility audit

---

## Rollback Plan

**If deployment fails**:

1. **Revert commit**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Vercel automatic rollback**:
   - Vercel will redeploy previous working version
   - No manual intervention required

3. **Investigate failure**:
   - Check Vercel build logs
   - Review browser console errors
   - Test locally to reproduce issue

---

## Support & Documentation

**Files to reference**:
- `spec.md` - Feature requirements
- `research.md` - Design decisions
- `data-model.md` - Type definitions and logic
- `contracts/` - Interface specifications
- `CLAUDE.md` - Project development guidelines
- `.specify/memory/constitution.md` - Project principles

**Key contacts**:
- Project maintainer: See repository CODEOWNERS file
- AI assistance: Use `.claude/commands/ai-board-assist.md`

---

## Next Steps After Implementation

1. **Monitor production metrics**:
   - Track user engagement with job type indicators
   - Monitor performance impact (should be negligible)
   - Collect user feedback on visual clarity

2. **Future enhancements** (not in scope):
   - Add job type filtering in ticket list
   - Add job type statistics to project dashboard
   - Customize job type colors per user preference

3. **Documentation updates**:
   - Update user guide with job type visual distinction
   - Add screenshots to project README
   - Update API documentation if needed
