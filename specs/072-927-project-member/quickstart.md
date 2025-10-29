# Developer Quickstart: Project Member Authorization

**Feature**: Project Member Authorization
**Branch**: `072-927-project-member`
**Date**: 2025-10-29

## Overview

This guide walks developers through implementing project member authorization. The goal is to update all project-scoped API endpoints from **owner-only** to **owner OR member** authorization while maintaining backward compatibility.

---

## Prerequisites

- Node.js 22.20.0 LTS
- Bun package manager
- PostgreSQL 14+ running locally
- Existing ProjectMember schema (no migration needed)
- NextAuth session-based authentication configured

---

## Step 1: Update Authorization Helpers

### 1.1 Create New Authorization Functions

Edit `lib/db/auth-helpers.ts` and add two new functions:

```typescript
// lib/db/auth-helpers.ts
import { requireAuth } from './users';
import { prisma } from './client';

/**
 * Verify that the current user has access to a project (owner OR member)
 * @throws Error if project not found or user doesn't have access
 * @returns The project if found and accessible
 */
export async function verifyProjectAccess(projectId: number) {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },                            // Owner access
        { members: { some: { userId } } }      // Member access
      ]
    },
    select: {
      id: true,
      name: true,
      githubOwner: true,
      githubRepo: true,
      clarificationPolicy: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}

/**
 * Verify that the current user has access to a ticket via project membership
 * @throws Error if ticket not found or user doesn't have access
 */
export async function verifyTicketAccess(ticketId: number): Promise<void> {
  const userId = await requireAuth();

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      project: {
        OR: [
          { userId },                          // Owner access
          { members: { some: { userId } } }    // Member access
        ]
      }
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }
}
```

### 1.2 Keep Existing Owner-Only Function

The existing `verifyProjectOwnership()` function remains unchanged for owner-only endpoints:

```typescript
/**
 * Verify that a project belongs to the current user (OWNER ONLY)
 * @throws Error if project not found or doesn't belong to user
 * @returns The project if found and owned by user
 */
export async function verifyProjectOwnership(projectId: number) {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,  // Owner-only check (no OR condition)
    },
    select: {
      id: true,
      name: true,
      githubOwner: true,
      githubRepo: true,
      clarificationPolicy: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}
```

---

## Step 2: Update API Endpoints

### 2.1 Project-Level Endpoints

**Update**: `app/api/projects/[projectId]/route.ts` (GET method)

**Before**:
```typescript
export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId);
  const project = await verifyProjectOwnership(projectId); // Owner-only
  return NextResponse.json(project);
}
```

**After**:
```typescript
export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId);
  const project = await verifyProjectAccess(projectId); // Owner OR member
  return NextResponse.json(project);
}
```

### 2.2 Ticket List/Create Endpoints

**Update**: `app/api/projects/[projectId]/tickets/route.ts`

**Before**:
```typescript
export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId);
  await verifyProjectOwnership(projectId); // Owner-only

  const tickets = await prisma.ticket.findMany({
    where: { projectId }
  });
  return NextResponse.json({ tickets });
}

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId);
  await verifyProjectOwnership(projectId); // Owner-only

  const body = await request.json();
  const ticket = await prisma.ticket.create({
    data: { ...body, projectId }
  });
  return NextResponse.json(ticket, { status: 201 });
}
```

**After**:
```typescript
export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId);
  await verifyProjectAccess(projectId); // Owner OR member

  const tickets = await prisma.ticket.findMany({
    where: { projectId }
  });
  return NextResponse.json({ tickets });
}

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId);
  await verifyProjectAccess(projectId); // Owner OR member

  const body = await request.json();
  const ticket = await prisma.ticket.create({
    data: { ...body, projectId }
  });
  return NextResponse.json(ticket, { status: 201 });
}
```

### 2.3 Ticket Detail Endpoints

**Update**: `app/api/projects/[projectId]/tickets/[id]/route.ts`

**Before**:
```typescript
export async function GET(request: Request, { params }: { params: { projectId: string; id: string } }) {
  const ticketId = parseInt(params.id);
  await verifyTicketOwnership(ticketId); // Owner-only

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId }
  });
  return NextResponse.json(ticket);
}

export async function PATCH(request: Request, { params }: { params: { projectId: string; id: string } }) {
  const ticketId = parseInt(params.id);
  await verifyTicketOwnership(ticketId); // Owner-only

  const body = await request.json();
  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: body
  });
  return NextResponse.json(ticket);
}
```

**After**:
```typescript
export async function GET(request: Request, { params }: { params: { projectId: string; id: string } }) {
  const ticketId = parseInt(params.id);
  await verifyTicketAccess(ticketId); // Owner OR member

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId }
  });
  return NextResponse.json(ticket);
}

export async function PATCH(request: Request, { params }: { params: { projectId: string; id: string } }) {
  const ticketId = parseInt(params.id);
  await verifyTicketAccess(ticketId); // Owner OR member

  const body = await request.json();
  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: body
  });
  return NextResponse.json(ticket);
}
```

### 2.4 Comment Endpoints

**Update**: `app/api/projects/[projectId]/tickets/[id]/comments/route.ts`

**Before**:
```typescript
export async function GET(request: Request, { params }: { params: { projectId: string; id: string } }) {
  const ticketId = parseInt(params.id);
  await verifyTicketOwnership(ticketId); // Owner-only

  const comments = await prisma.comment.findMany({
    where: { ticketId }
  });
  return NextResponse.json({ comments });
}

export async function POST(request: Request, { params }: { params: { projectId: string; id: string } }) {
  const ticketId = parseInt(params.id);
  await verifyTicketOwnership(ticketId); // Owner-only

  const body = await request.json();
  const userId = await requireAuth();
  const comment = await prisma.comment.create({
    data: { ...body, ticketId, userId }
  });
  return NextResponse.json(comment, { status: 201 });
}
```

**After**:
```typescript
export async function GET(request: Request, { params }: { params: { projectId: string; id: string } }) {
  const ticketId = parseInt(params.id);
  await verifyTicketAccess(ticketId); // Owner OR member

  const comments = await prisma.comment.findMany({
    where: { ticketId }
  });
  return NextResponse.json({ comments });
}

export async function POST(request: Request, { params }: { params: { projectId: string; id: string } }) {
  const ticketId = parseInt(params.id);
  await verifyTicketAccess(ticketId); // Owner OR member

  const body = await request.json();
  const userId = await requireAuth();
  const comment = await prisma.comment.create({
    data: { ...body, ticketId, userId }
  });
  return NextResponse.json(comment, { status: 201 });
}
```

### 2.5 Owner-Only Endpoints (Member Management)

**NO CHANGE**: `app/api/projects/[projectId]/members/route.ts`

These endpoints remain owner-only (use `verifyProjectOwnership`):

```typescript
export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId);
  await verifyProjectOwnership(projectId); // Owner-only (no change)

  const body = await request.json();
  const member = await prisma.projectMember.create({
    data: { ...body, projectId }
  });
  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId);
  await verifyProjectOwnership(projectId); // Owner-only (no change)

  const { memberId } = await request.json();
  await prisma.projectMember.delete({
    where: { id: memberId }
  });
  return new NextResponse(null, { status: 204 });
}
```

---

## Step 3: Update Board SSR Page

**Update**: `app/projects/[projectId]/board/page.tsx`

**Before**:
```typescript
export default async function BoardPage({ params }: { params: { projectId: string } }) {
  try {
    const projectId = parseInt(params.projectId);
    const project = await verifyProjectOwnership(projectId); // Owner-only

    return <BoardComponent project={project} />;
  } catch (error) {
    notFound(); // Return 404 for unauthorized access
  }
}
```

**After**:
```typescript
export default async function BoardPage({ params }: { params: { projectId: string } }) {
  try {
    const projectId = parseInt(params.projectId);
    const project = await verifyProjectAccess(projectId); // Owner OR member

    return <BoardComponent project={project} />;
  } catch (error) {
    notFound(); // Return 404 for unauthorized access
  }
}
```

---

## Step 4: Error Handling Patterns

### 4.1 API Routes (Return 403 Forbidden)

```typescript
export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  try {
    const projectId = parseInt(params.projectId);
    await verifyProjectAccess(projectId);

    // ... endpoint logic
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
}
```

### 4.2 SSR Pages (Return 404 Not Found)

```typescript
export default async function Page({ params }: { params: { projectId: string } }) {
  try {
    const projectId = parseInt(params.projectId);
    const project = await verifyProjectAccess(projectId);

    return <Component project={project} />;
  } catch (error) {
    notFound(); // Next.js helper returns 404 page
  }
}
```

---

## Step 5: Write Tests

### 5.1 Unit Tests (Vitest)

Create `tests/unit/auth-helpers.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyProjectAccess, verifyTicketAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';

describe('verifyProjectAccess', () => {
  it('returns project when user is owner', async () => {
    // Mock requireAuth to return owner userId
    vi.mock('@/lib/db/users', () => ({
      requireAuth: vi.fn().mockResolvedValue('owner-id')
    }));

    const project = await verifyProjectAccess(1);
    expect(project).toBeDefined();
    expect(project.id).toBe(1);
  });

  it('returns project when user is member', async () => {
    // Mock requireAuth to return member userId
    vi.mock('@/lib/db/users', () => ({
      requireAuth: vi.fn().mockResolvedValue('member-id')
    }));

    const project = await verifyProjectAccess(1);
    expect(project).toBeDefined();
    expect(project.id).toBe(1);
  });

  it('throws when user is neither owner nor member', async () => {
    // Mock requireAuth to return non-member userId
    vi.mock('@/lib/db/users', () => ({
      requireAuth: vi.fn().mockResolvedValue('stranger-id')
    }));

    await expect(verifyProjectAccess(1)).rejects.toThrow('Project not found');
  });
});
```

**Run unit tests**:
```bash
bun run test:unit
```

### 5.2 API Contract Tests (Playwright)

Create `tests/api/project-member-auth.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/client';

test.describe('Project Member Authorization', () => {
  let ownerUserId: string;
  let memberUserId: string;
  let projectId: number;

  test.beforeEach(async () => {
    // Create owner user
    const owner = await prisma.user.upsert({
      where: { email: 'owner@e2e.local' },
      update: {},
      create: {
        email: 'owner@e2e.local',
        name: 'Owner User',
        emailVerified: new Date(),
      },
    });
    ownerUserId = owner.id;

    // Create member user
    const member = await prisma.user.upsert({
      where: { email: 'member@e2e.local' },
      update: {},
      create: {
        email: 'member@e2e.local',
        name: 'Member User',
        emailVerified: new Date(),
      },
    });
    memberUserId = member.id;

    // Create project owned by owner
    const project = await prisma.project.create({
      data: {
        name: '[e2e] Test Project',
        description: 'Test project for member auth',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: ownerUserId,
      },
    });
    projectId = project.id;

    // Add member to project
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: memberUserId,
        role: 'member',
      },
    });
  });

  test('owner can list tickets', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}/tickets`, {
      headers: { 'X-Test-User-Id': ownerUserId },
    });
    expect(response.status()).toBe(200);
  });

  test('member can list tickets', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}/tickets`, {
      headers: { 'X-Test-User-Id': memberUserId },
    });
    expect(response.status()).toBe(200);
  });

  test('non-member receives 403', async ({ request }) => {
    const stranger = await prisma.user.create({
      data: {
        email: 'stranger@e2e.local',
        name: 'Stranger User',
        emailVerified: new Date(),
      },
    });

    const response = await request.get(`/api/projects/${projectId}/tickets`, {
      headers: { 'X-Test-User-Id': stranger.id },
    });
    expect(response.status()).toBe(403);
  });

  test('member cannot add other members', async ({ request }) => {
    const response = await request.post(`/api/projects/${projectId}/members`, {
      headers: { 'X-Test-User-Id': memberUserId },
      data: { userId: 'another-user-id', role: 'member' },
    });
    expect(response.status()).toBe(403);
  });
});
```

**Run API tests**:
```bash
bun run test:e2e tests/api/project-member-auth.spec.ts
```

### 5.3 E2E Tests (Playwright)

Create `tests/e2e/board-member-access.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/client';

test.describe('Board Member Access', () => {
  test('member can access project board', async ({ page }) => {
    // Create owner and member users
    const owner = await prisma.user.create({
      data: { email: 'owner@e2e.local', name: 'Owner', emailVerified: new Date() },
    });
    const member = await prisma.user.create({
      data: { email: 'member@e2e.local', name: 'Member', emailVerified: new Date() },
    });

    // Create project with member
    const project = await prisma.project.create({
      data: {
        name: '[e2e] Test Project',
        description: 'Test',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: owner.id,
        members: {
          create: { userId: member.id, role: 'member' },
        },
      },
    });

    // Set test user to member
    await page.setExtraHTTPHeaders({
      'X-Test-User-Id': member.id,
    });

    // Navigate to board
    await page.goto(`/projects/${project.id}/board`);

    // Verify board loads (no 404/403)
    await expect(page).toHaveURL(`/projects/${project.id}/board`);
    await expect(page.locator('h1')).toContainText(project.name);
  });

  test('non-member receives 404', async ({ page }) => {
    const owner = await prisma.user.create({
      data: { email: 'owner@e2e.local', name: 'Owner', emailVerified: new Date() },
    });
    const stranger = await prisma.user.create({
      data: { email: 'stranger@e2e.local', name: 'Stranger', emailVerified: new Date() },
    });

    const project = await prisma.project.create({
      data: {
        name: '[e2e] Test Project',
        description: 'Test',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: owner.id,
      },
    });

    // Set test user to stranger
    await page.setExtraHTTPHeaders({
      'X-Test-User-Id': stranger.id,
    });

    // Navigate to board
    await page.goto(`/projects/${project.id}/board`);

    // Verify 404 page
    await expect(page.locator('h1')).toContainText('404');
  });
});
```

**Run E2E tests**:
```bash
bun run test:e2e tests/e2e/board-member-access.spec.ts
```

---

## Step 6: Run Full Test Suite

### 6.1 Run All Tests

```bash
bun test            # Runs Vitest + Playwright
```

Or run separately:

```bash
bun run test:unit   # Vitest only (~1ms per test)
bun run test:e2e    # Playwright only (~500ms-2s per test)
```

### 6.2 Verify Test Coverage

All 22 endpoints should have test coverage:
- ✅ Owner access (backward compatibility)
- ✅ Member access (new functionality)
- ✅ Non-member rejection (security)

---

## Step 7: Manual Testing

### 7.1 Create Test Data

Use Prisma Studio or seed script:

```typescript
// scripts/seed-member-test-data.ts
import { prisma } from '@/lib/db/client';

async function main() {
  // Create users
  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      name: 'Project Owner',
      emailVerified: new Date(),
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      email: 'member@example.com',
      name: 'Project Member',
      emailVerified: new Date(),
    },
  });

  // Create project with member
  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      description: 'Project for testing member authorization',
      githubOwner: 'test',
      githubRepo: 'test-repo',
      userId: owner.id,
      members: {
        create: {
          userId: member.id,
          role: 'member',
        },
      },
    },
  });

  console.log('Created project:', project.id);
}

main();
```

**Run seed script**:
```bash
npx tsx scripts/seed-member-test-data.ts
```

### 7.2 Test Manually in Browser

1. **Login as owner**:
   - Navigate to `/projects/:id/board`
   - Verify board loads
   - Create ticket
   - Verify ticket appears

2. **Login as member**:
   - Navigate to `/projects/:id/board`
   - Verify board loads with same tickets
   - Create ticket
   - Update existing ticket
   - Add comment

3. **Login as non-member**:
   - Navigate to `/projects/:id/board`
   - Verify 404 page shown

---

## Step 8: Performance Testing

### 8.1 Benchmark Authorization Queries

Add performance assertions to E2E tests:

```typescript
test('authorization query completes under 100ms', async ({ request }) => {
  const start = Date.now();

  await request.get(`/api/projects/1/tickets`, {
    headers: { 'X-Test-User-Id': memberUserId },
  });

  const duration = Date.now() - start;
  expect(duration).toBeLessThan(100); // <100ms p95 target
});
```

### 8.2 Check Database Query Plans

Use Prisma logging to verify index usage:

```typescript
// lib/db/client.ts
export const prisma = new PrismaClient({
  log: ['query'], // Enable query logging
});
```

Run a test and check logs for:
- ✅ Index scans (not table scans)
- ✅ Single query (not N+1)
- ✅ Query duration <100ms

---

## Step 9: Deployment Checklist

### 9.1 Pre-Deployment

- [ ] All tests pass (unit + API + E2E)
- [ ] Performance benchmarks meet targets (<100ms p95)
- [ ] Code review completed
- [ ] Authorization logic audited for security
- [ ] Documentation updated (CLAUDE.md)

### 9.2 Deployment

```bash
git add .
git commit -m "feat(authorization): add project member access"
git push origin 072-927-project-member
```

Create pull request with:
- Summary of changes (22 endpoints updated)
- Test coverage report
- Performance benchmark results
- Breaking changes: NONE (backward compatible)

### 9.3 Post-Deployment

- [ ] Verify production deployment succeeds
- [ ] Run smoke tests on production
- [ ] Monitor error logs for authorization failures
- [ ] Verify existing owner access still works (backward compatibility)

---

## Troubleshooting

### Issue: Authorization fails with "Project not found"

**Cause**: Membership query may not be finding ProjectMember records

**Solution**:
1. Verify ProjectMember records exist in database
2. Check indexes on `projectId` and `userId`
3. Verify Prisma query logs for JOIN performance

```typescript
// Debug query
const project = await prisma.project.findFirst({
  where: {
    id: projectId,
    OR: [
      { userId },
      { members: { some: { userId } } }
    ]
  },
  include: {
    members: true, // Include members for debugging
  }
});
console.log('Project:', project);
console.log('Members:', project?.members);
```

### Issue: Tests fail with foreign key constraint errors

**Cause**: Test cleanup may not be deleting ProjectMember records

**Solution**: Update `tests/helpers/db-cleanup.ts` to clean up ProjectMember:

```typescript
await prisma.projectMember.deleteMany({
  where: {
    projectId: { in: [1, 2] } // Test projects
  }
});
```

### Issue: Performance degradation (queries >100ms)

**Cause**: Missing indexes or inefficient query patterns

**Solution**:
1. Verify indexes exist: `@@index([projectId])`, `@@index([userId])`
2. Check query plan with `EXPLAIN ANALYZE` in PostgreSQL
3. Consider denormalizing if JOIN performance is poor

---

## Reference Files

- **Feature Spec**: `specs/072-927-project-member/spec.md`
- **Data Model**: `specs/072-927-project-member/data-model.md`
- **API Contracts**: `specs/072-927-project-member/contracts/api-authorization.md`
- **Research**: `specs/072-927-project-member/research.md`
- **Constitution**: `.specify/memory/constitution.md`

---

## Next Steps

After completing this implementation:

1. **Review Pull Request**: Have another developer review authorization logic
2. **Security Audit**: Ensure no authorization bypasses exist
3. **Performance Monitoring**: Track query performance in production
4. **Documentation**: Update team docs with member authorization patterns
5. **Future Enhancements**: Plan role-based permissions (admin/member/viewer)

---

## Questions?

- Check `specs/072-927-project-member/` for detailed specifications
- Review existing authorization patterns in `lib/db/auth-helpers.ts`
- Consult constitution for security and testing requirements
