# Tasks: Projects List Page

**Feature**: Projects List Page
**Branch**: `023-16193-page-projects`
**Status**: Ready for Implementation
**TDD Approach**: Red → Green → Refactor

---

## Task Overview

**Total Tasks**: 13
**Parallel Tasks**: 5 (marked with [P])
**Sequential Tasks**: 8
**Estimated Time**: 2-3 hours

---

## Implementation Order

### Phase 1: Test Setup (TDD Red Phase)
**Tasks**: T001-T003
**Goal**: Write failing tests that define acceptance criteria

### Phase 2: Component Implementation (Parallel Possible)
**Tasks**: T004-T006 [P]
**Goal**: Build UI components independently

### Phase 3: API Implementation
**Tasks**: T007-T008
**Goal**: Create backend endpoint and contract test

### Phase 4: Integration
**Tasks**: T009-T010
**Goal**: Wire components together in page

### Phase 5: Verification (TDD Green Phase)
**Tasks**: T011-T013
**Goal**: Make all tests pass and verify

---

## Tasks

### T001: Write E2E Test for Projects List (Red Phase) [P]

**Priority**: CRITICAL (TDD - Must fail initially)
**File**: `/tests/e2e/projects-list.spec.ts`
**Dependencies**: None
**Parallel**: Yes (independent file)

**Description**:
Write comprehensive E2E test covering all acceptance scenarios from spec.md. Test MUST fail initially (Red phase) since feature not implemented yet.

**User Context Note**: **CRITICAL - Do NOT delete existing projects in test setup. Only use test-specific projects (e.g., projects with `[e2e]` prefix in name) for test isolation. Follow existing test patterns in `/tests/helpers/db-cleanup.ts` which preserve non-test data.**

**Acceptance Criteria**:
1. Test navigates to `/projects` route
2. Test verifies projects list displays
3. Test checks project cards show: name, description, updatedAt, ticketCount
4. Test validates hover effect (scale transform, cursor pointer)
5. Test clicks project card and verifies navigation to `/projects/{id}/board`
6. Test verifies "Import Project" and "Create Project" buttons are visible but disabled
7. Test validates empty state when no projects exist
8. Test runs and FAILS (Red phase - feature not implemented)

**Implementation Steps**:
```typescript
// File: /tests/e2e/projects-list.spec.ts

import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

test.describe('Projects List Page', () => {
  test.beforeEach(async () => {
    // IMPORTANT: Only clean up test data, preserve existing projects
    await cleanupDatabase(); // This function preserves non-[e2e] prefixed data
  });

  test('displays all projects with correct information', async ({ page }) => {
    // Navigate to projects page
    await page.goto('http://localhost:3000/projects');

    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]');

    // Verify project cards display
    const projectCards = await page.locator('[data-testid="project-card"]').count();
    expect(projectCards).toBeGreaterThan(0);

    // Verify first project shows all required fields
    const firstCard = page.locator('[data-testid="project-card"]').first();
    await expect(firstCard.locator('[data-testid="project-name"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="project-description"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="project-updated"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="project-ticket-count"]')).toBeVisible();
  });

  test('navigates to board when clicking project card', async ({ page }) => {
    await page.goto('http://localhost:3000/projects');
    await page.waitForSelector('[data-testid="project-card"]');

    // Get first project ID
    const firstCard = page.locator('[data-testid="project-card"]').first();
    const projectId = await firstCard.getAttribute('data-project-id');

    // Click project card
    await firstCard.click();

    // Verify navigation to board
    await expect(page).toHaveURL(`/projects/${projectId}/board`);
  });

  test('shows hover effect on project cards', async ({ page }) => {
    await page.goto('http://localhost:3000/projects');
    await page.waitForSelector('[data-testid="project-card"]');

    const firstCard = page.locator('[data-testid="project-card"]').first();

    // Hover over card
    await firstCard.hover();

    // Verify cursor changes to pointer
    const cursor = await firstCard.evaluate(el => window.getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');

    // Verify scale transform applied (check for transform property)
    const transform = await firstCard.evaluate(el => window.getComputedStyle(el).transform);
    expect(transform).not.toBe('none');
  });

  test('displays Import and Create Project buttons as disabled', async ({ page }) => {
    await page.goto('http://localhost:3000/projects');

    // Verify Import Project button
    const importButton = page.getByRole('button', { name: /import project/i });
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeDisabled();

    // Verify Create Project button
    const createButton = page.getByRole('button', { name: /create project/i });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeDisabled();
  });

  test('displays empty state when no projects exist', async ({ page }) => {
    // This test requires all projects to be removed - handle carefully
    // Consider using a fresh test database or careful cleanup
    await page.goto('http://localhost:3000/projects');

    // Verify empty state message
    await expect(page.getByText(/no projects available/i)).toBeVisible();
    await expect(page.getByText(/create project/i)).toBeVisible();
  });
});
```

**Verification**:
```bash
npx playwright test tests/e2e/projects-list.spec.ts
# Expected: All tests FAIL (Red phase)
```

---

### T002: Write API Contract Test (Red Phase) [P]

**Priority**: HIGH
**File**: `/tests/e2e/projects-api-contract.spec.ts`
**Dependencies**: None
**Parallel**: Yes (independent file)

**Description**:
Write contract test validating GET /api/projects endpoint matches OpenAPI contract. Test MUST fail initially.

**Acceptance Criteria**:
1. Test calls GET /api/projects
2. Test validates 200 status code
3. Test validates response is JSON array
4. Test validates each project object has: id, name, description, updatedAt, ticketCount
5. Test validates field types match contract
6. Test validates no extra fields in response (no githubOwner, githubRepo, createdAt)
7. Test runs and FAILS (endpoint doesn't exist yet)

**Implementation Steps**:
```typescript
// File: /tests/e2e/projects-api-contract.spec.ts

import { test, expect } from '@playwright/test';

test.describe('GET /api/projects Contract', () => {
  test('returns projects array matching contract', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/projects');

    // Validate status
    expect(response.status()).toBe(200);

    // Validate content type
    expect(response.headers()['content-type']).toContain('application/json');

    // Parse response
    const projects = await response.json();

    // Validate array
    expect(Array.isArray(projects)).toBe(true);

    // If projects exist, validate structure
    if (projects.length > 0) {
      const project = projects[0];

      // Required fields exist
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('description');
      expect(project).toHaveProperty('updatedAt');
      expect(project).toHaveProperty('ticketCount');

      // Field types
      expect(typeof project.id).toBe('number');
      expect(typeof project.name).toBe('string');
      expect(typeof project.description).toBe('string');
      expect(typeof project.updatedAt).toBe('string');
      expect(typeof project.ticketCount).toBe('number');

      // Validate ISO 8601 timestamp format
      expect(new Date(project.updatedAt).toISOString()).toBe(project.updatedAt);

      // Ensure no extra fields (security check)
      const allowedKeys = ['id', 'name', 'description', 'updatedAt', 'ticketCount'];
      const actualKeys = Object.keys(project);
      expect(actualKeys.sort()).toEqual(allowedKeys.sort());
    }
  });

  test('returns empty array when no projects exist', async ({ request }) => {
    // This test assumes a scenario where no projects exist
    // May need database cleanup for this specific test case
    const response = await request.get('http://localhost:3000/api/projects');

    expect(response.status()).toBe(200);
    const projects = await response.json();
    expect(Array.isArray(projects)).toBe(true);
  });
});
```

**Verification**:
```bash
npx playwright test tests/e2e/projects-api-contract.spec.ts
# Expected: Tests FAIL (endpoint doesn't exist)
```

---

### T003: Create TypeScript Interfaces for API Response

**Priority**: HIGH
**File**: `/app/lib/types/project.ts` (new file)
**Dependencies**: None
**Parallel**: Can work simultaneously with T001-T002

**Description**:
Define TypeScript interfaces matching API contract for type safety across frontend and backend.

**Acceptance Criteria**:
1. Interface `ProjectWithCount` defined with all required fields
2. Field types match OpenAPI contract exactly
3. Interface exported for use in API route and components
4. No `any` types used (TypeScript strict mode compliance)

**Implementation Steps**:
```typescript
// File: /app/lib/types/project.ts

/**
 * Project with computed ticket count
 * Matches GET /api/projects response schema
 */
export interface ProjectWithCount {
  id: number;
  name: string;
  description: string;
  updatedAt: string; // ISO 8601 timestamp
  ticketCount: number;
}

/**
 * API response for GET /api/projects
 */
export type ProjectsListResponse = ProjectWithCount[];
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: No type errors
```

---

### T004: Create Empty State Component [P]

**Priority**: MEDIUM
**File**: `/components/projects/empty-projects-state.tsx`
**Dependencies**: None
**Parallel**: Yes (independent component)

**Description**:
Create component displaying message when no projects exist, with call-to-action text referencing Create Project button.

**Acceptance Criteria**:
1. Component displays "No projects available" message
2. Component includes call-to-action text mentioning "Create Project" button
3. Layout is centered and clean
4. Component is a Server Component (no interactivity needed)
5. TypeScript strict mode compliant

**Implementation Steps**:
```typescript
// File: /components/projects/empty-projects-state.tsx

export function EmptyProjectsState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <h2 className="text-2xl font-semibold text-gray-700 mb-2">
        No projects available
      </h2>
      <p className="text-gray-500">
        Get started by clicking the "Create Project" button above
      </p>
    </div>
  );
}
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: No type errors
```

---

### T005: Create Project Card Component [P]

**Priority**: HIGH
**File**: `/components/projects/project-card.tsx`
**Dependencies**: T003 (TypeScript interfaces)
**Parallel**: Yes (independent component)

**Description**:
Create interactive project card component with hover effects and navigation. MUST be Client Component for interactivity.

**Acceptance Criteria**:
1. Component is Client Component (`"use client"` directive)
2. Uses shadcn/ui Card components (Card, CardHeader, CardTitle, CardDescription, CardContent)
3. Displays: name, description, updatedAt (formatted), ticketCount
4. Implements hover effect: `hover:scale-105 transition-transform duration-200 cursor-pointer`
5. Navigates to `/projects/{id}/board` on click using `useRouter`
6. Includes data-testid attributes for E2E tests
7. TypeScript strict mode compliant with ProjectWithCount interface

**Implementation Steps**:
```typescript
// File: /components/projects/project-card.tsx
'use client';

import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ProjectWithCount } from '@/app/lib/types/project';

interface ProjectCardProps {
  project: ProjectWithCount;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/projects/${project.id}/board`);
  };

  // Format timestamp
  const formattedDate = new Date(project.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card
      className="transition-transform duration-200 hover:scale-105 cursor-pointer"
      onClick={handleClick}
      data-testid="project-card"
      data-project-id={project.id}
    >
      <CardHeader>
        <CardTitle data-testid="project-name">{project.name}</CardTitle>
        <CardDescription data-testid="project-description">
          {project.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm text-gray-500">
          <span data-testid="project-updated">
            Last updated: {formattedDate}
          </span>
          <span data-testid="project-ticket-count">
            {project.ticketCount} {project.ticketCount === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: No type errors
```

---

### T006: Create Projects Container Component [P]

**Priority**: MEDIUM
**File**: `/components/projects/projects-container.tsx`
**Dependencies**: T003, T004, T005
**Parallel**: Yes (independent component)

**Description**:
Create container component managing projects list layout with scrollable container and empty state handling.

**Acceptance Criteria**:
1. Component accepts array of ProjectWithCount objects
2. Displays EmptyProjectsState when projects array is empty
3. Displays ProjectCard components in responsive grid when projects exist
4. Implements scrollable container with overflow-y-auto
5. Can be Server or Client Component (no state needed)
6. TypeScript strict mode compliant

**Implementation Steps**:
```typescript
// File: /components/projects/projects-container.tsx

import { ProjectCard } from './project-card';
import { EmptyProjectsState } from './empty-projects-state';
import type { ProjectWithCount } from '@/app/lib/types/project';

interface ProjectsContainerProps {
  projects: ProjectWithCount[];
}

export function ProjectsContainer({ projects }: ProjectsContainerProps) {
  if (projects.length === 0) {
    return <EmptyProjectsState />;
  }

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
```

**Verification**:
```bash
npx tsc --noEmit
# Expected: No type errors
```

---

### T007: Implement GET /api/projects Endpoint

**Priority**: CRITICAL
**File**: `/app/api/projects/route.ts`
**Dependencies**: T003 (TypeScript interfaces)
**Parallel**: No (depends on types, used by page)

**Description**:
Implement API endpoint fetching all projects with ticket counts using Prisma aggregation. Makes T002 contract test pass.

**User Context Note**: **CRITICAL - Endpoint MUST return ALL projects from database. Do NOT filter or delete existing projects. This is a read-only operation that should preserve all existing data.**

**Acceptance Criteria**:
1. GET handler exported from route.ts
2. Uses Prisma `findMany` with `_count` aggregation for ticket counts
3. Orders projects by `updatedAt` descending
4. Returns JSON array matching ProjectsListResponse type
5. Response excludes sensitive fields (githubOwner, githubRepo, createdAt)
6. Includes try-catch error handling with 500 response
7. TypeScript strict mode compliant
8. T002 contract test passes after implementation

**Implementation Steps**:
```typescript
// File: /app/api/projects/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import type { ProjectsListResponse } from '@/app/lib/types/project';

export async function GET() {
  try {
    // Fetch all projects with ticket counts
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to API response shape
    const response: ProjectsListResponse = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      updatedAt: project.updatedAt.toISOString(),
      ticketCount: project._count.tickets,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
```

**Verification**:
```bash
# Start dev server
npm run dev

# Test endpoint manually
curl http://localhost:3000/api/projects

# Run contract test
npx playwright test tests/e2e/projects-api-contract.spec.ts
# Expected: Tests PASS (Green phase)
```

---

### T008: Verify API Contract Test Passes (Green Phase)

**Priority**: HIGH
**File**: N/A (verification task)
**Dependencies**: T007
**Parallel**: No

**Description**:
Run T002 contract test to verify it now passes after API implementation. This is the Green phase of TDD for API.

**Acceptance Criteria**:
1. T002 contract test passes with all assertions
2. API returns 200 status
3. Response matches OpenAPI contract
4. No sensitive fields exposed

**Verification**:
```bash
npx playwright test tests/e2e/projects-api-contract.spec.ts
# Expected: All tests PASS
```

---

### T009: Create Projects List Page

**Priority**: CRITICAL
**File**: `/app/projects/page.tsx`
**Dependencies**: T003, T004, T005, T006, T007
**Parallel**: No (integrates multiple components)

**Description**:
Create Next.js 15 App Router page integrating all components and fetching data from API. Server Component for initial data fetch.

**Acceptance Criteria**:
1. Server Component (no `"use client"` directive)
2. Fetches projects from GET /api/projects
3. Renders placeholder Import/Create buttons (disabled)
4. Uses lucide-react icons for buttons
5. Passes projects data to ProjectsContainer
6. Includes page title and layout
7. TypeScript strict mode compliant
8. No client-side state management needed

**Implementation Steps**:
```typescript
// File: /app/projects/page.tsx

import { ProjectsContainer } from '@/components/projects/projects-container';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';
import type { ProjectsListResponse } from '@/app/lib/types/project';

async function getProjects(): Promise<ProjectsListResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/projects`, {
    cache: 'no-store', // Always fetch fresh data
  });

  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }

  return response.json();
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <div className="flex gap-4">
          <Button variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" />
            Import Project
          </Button>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </div>
      </div>

      <ProjectsContainer projects={projects} />
    </div>
  );
}
```

**Verification**:
```bash
# Start dev server
npm run dev

# Navigate to http://localhost:3000/projects
# Expected: Page renders with projects list

npx tsc --noEmit
# Expected: No type errors
```

---

### T010: Add Page Metadata and Error Handling

**Priority**: MEDIUM
**File**: `/app/projects/page.tsx` (update existing)
**Dependencies**: T009
**Parallel**: No

**Description**:
Add Next.js metadata export and error boundary for production-ready page.

**Acceptance Criteria**:
1. Export `metadata` object with title and description
2. Add error boundary component or error.tsx
3. Handle fetch failures gracefully
4. TypeScript strict mode compliant

**Implementation Steps**:
```typescript
// File: /app/projects/page.tsx (add to existing)

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects | AI Board',
  description: 'View and manage all projects in your AI Board workspace',
};

// Update getProjects function to handle errors
async function getProjects(): Promise<ProjectsListResponse> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/projects`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch projects:', response.statusText);
      return []; // Return empty array on error (graceful degradation)
    }

    return response.json();
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return []; // Return empty array on error
  }
}
```

**Verification**:
```bash
npm run dev
# Check browser tab title shows "Projects | AI Board"
```

---

### T011: Run Full E2E Test Suite (Green Phase)

**Priority**: CRITICAL
**File**: N/A (verification task)
**Dependencies**: T009, T010
**Parallel**: No

**Description**:
Run T001 E2E tests to verify all acceptance criteria pass. This is the Green phase of TDD for the entire feature.

**Acceptance Criteria**:
1. All T001 test scenarios pass
2. Projects display correctly
3. Hover effects work
4. Navigation works
5. Buttons are disabled
6. Empty state works (if tested)

**Verification**:
```bash
# Ensure dev server running
npm run dev

# Run E2E tests
npx playwright test tests/e2e/projects-list.spec.ts
# Expected: All tests PASS (Green phase achieved)
```

---

### T012: Manual Quickstart Validation

**Priority**: HIGH
**File**: N/A (validation task)
**Dependencies**: T011
**Parallel**: No

**Description**:
Perform manual validation using quickstart.md scenarios to ensure feature works as expected in real browser.

**Acceptance Criteria**:
1. Complete all 8 scenarios in quickstart.md
2. All checkboxes pass
3. No console errors
4. Performance within targets (<200ms page load, 60fps animations)

**Verification**:
Follow `/specs/023-16193-page-projects/quickstart.md` step-by-step.

---

### T013: Performance Optimization and Polish

**Priority**: MEDIUM
**File**: Multiple files (optimization)
**Dependencies**: T012
**Parallel**: No

**Description**:
Final performance optimizations and code polish based on quickstart validation results.

**Acceptance Criteria**:
1. Page load time < 200ms (after API response)
2. Animations run at 60fps
3. No unnecessary re-renders
4. Code follows TypeScript strict mode
5. All ESLint/Prettier rules pass

**Implementation Steps**:
1. Run performance profiling in Chrome DevTools
2. Verify no hydration warnings in console
3. Check React DevTools Profiler for unnecessary renders
4. Run linter and fix any issues
5. Verify all TypeScript strict mode compliance

**Verification**:
```bash
# Lint check
npm run lint

# Type check
npx tsc --noEmit

# Build check (production optimization)
npm run build
# Expected: Build succeeds, no warnings

# Run all tests
npx playwright test tests/e2e/projects-list.spec.ts
npx playwright test tests/e2e/projects-api-contract.spec.ts
# Expected: All tests PASS
```

---

## Parallel Execution Strategy

### Batch 1: Test Setup (Run in Parallel)
```bash
# Terminal 1: Write E2E test
# T001

# Terminal 2: Write contract test
# T002

# Terminal 3: Create TypeScript interfaces
# T003

# These can all be done simultaneously by different developers or AI agents
```

### Batch 2: Component Development (Run in Parallel)
```bash
# After T003 completes (types available)

# Terminal 1: Empty state component
# T004

# Terminal 2: Project card component
# T005

# Terminal 3: Projects container
# T006

# These are independent React components
```

### Batch 3: Sequential Implementation
```bash
# Must be done in order (dependencies)

# 1. Implement API endpoint
# T007

# 2. Verify contract test passes
# T008

# 3. Create page integrating components
# T009

# 4. Add metadata and error handling
# T010

# 5. Run E2E tests
# T011

# 6. Manual validation
# T012

# 7. Performance optimization
# T013
```

---

## Success Criteria

**Feature Complete When**:
- [ ] All 13 tasks completed
- [ ] All E2E tests pass (T001 scenarios)
- [ ] API contract test passes (T002)
- [ ] Manual quickstart validation passes (T012)
- [ ] TypeScript compilation succeeds with no errors
- [ ] ESLint passes with no errors
- [ ] Performance targets met (<200ms load, 60fps)
- [ ] No console errors in browser

**TDD Verification**:
- ✓ Red Phase: T001-T002 wrote failing tests
- ✓ Green Phase: T008, T011 verified tests pass
- ✓ Refactor Phase: T013 optimized without breaking tests

---

## Notes

**Critical Reminders**:
1. **DO NOT delete existing projects**: All database operations are read-only. Test cleanup should only affect test data with `[e2e]` prefixes.
2. **TDD Discipline**: Tests written before implementation (T001-T002 before T007-T009)
3. **TypeScript Strict**: All code uses strict mode, no `any` types
4. **Component Architecture**: Server Components by default, Client Components only for interactivity
5. **Shadcn/ui Only**: Use existing shadcn/ui components, no custom UI primitives

**Estimated Time Breakdown**:
- Phase 1 (Tests): 30-45 minutes
- Phase 2 (Components): 45-60 minutes
- Phase 3 (API): 15-20 minutes
- Phase 4 (Integration): 20-30 minutes
- Phase 5 (Verification): 15-20 minutes
- **Total**: 2-3 hours for experienced developer

---

**Last Updated**: 2025-10-11
**Ready for Implementation**: Yes ✓
