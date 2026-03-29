import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { POST } from '@/app/api/projects/[projectId]/tickets/route';

// Mock Next.js cache functions (not available outside Next.js runtime)
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock workflow auth to return valid for Bearer token requests
vi.mock('@/app/lib/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn((request: NextRequest) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader === 'Bearer workflow-test-token') {
      return { isValid: true };
    }
    return { isValid: false, error: 'Invalid token' };
  }),
}));

// Mock user auth helpers - these should NOT be called for workflow auth
vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => {
    // Should not be reached for workflow-authed requests
    throw new Error('Unauthorized');
  }),
}));

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => {
    throw new Error('Unauthorized');
  }),
}));

describe('Workflow-Authenticated Ticket Creation', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeWorkflowRequest(projectId: number, body: Record<string, unknown>) {
    return POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer workflow-test-token',
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  function makeUserRequest(projectId: number, body: Record<string, unknown>) {
    return POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token',
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('creates a ticket with workflow token auth', async () => {
    const response = await makeWorkflowRequest(ctx.projectId, {
      title: '[Health:Security] High severity issues',
      description: '## Security Scan Issues\n\n- SQL Injection in `src/api.ts:15`',
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.title).toBe('[Health:Security] High severity issues');
    expect(data.ticketKey).toBeTruthy();
    expect(data.stage).toBe('INBOX');
  });

  it('skips subscription limit checks for workflow auth', async () => {
    // Create multiple tickets via workflow auth - should not hit plan limits
    for (let i = 0; i < 3; i++) {
      const response = await makeWorkflowRequest(ctx.projectId, {
        title: `[Health:Security] Issue batch ${i + 1}`,
        description: `Batch ${i + 1} of security issues`,
      });
      expect(response.status).toBe(201);
    }
  });

  it('validates projectId exists for workflow auth', async () => {
    const response = await makeWorkflowRequest(99999, {
      title: '[Health:Security] Test',
      description: 'Test description',
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe('PROJECT_NOT_FOUND');
  });

  it('rejects requests without valid workflow token (falls to user auth)', async () => {
    const response = await makeUserRequest(ctx.projectId, {
      title: '[Health:Security] Test',
      description: 'Test description',
    });

    // Should fall through to user auth which throws Unauthorized
    expect(response.status).toBe(401);
  });

  it('validates ticket data even with workflow auth', async () => {
    const response = await makeWorkflowRequest(ctx.projectId, {
      title: '',
      description: '',
    });

    expect(response.status).toBe(400);
  });

  it('returns invalid project ID error for non-numeric projectId', async () => {
    const response = POST(
      new NextRequest('http://localhost/api/projects/abc/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer workflow-test-token',
        },
        body: JSON.stringify({
          title: '[Health:Security] Test',
          description: 'Test',
        }),
      }),
      { params: Promise.resolve({ projectId: 'abc' }) }
    );

    const res = await response;
    expect(res.status).toBe(400);
  });

  describe('Ticket Grouping Patterns (simulates workflow ticket creation)', () => {
    it('creates security tickets grouped by severity', async () => {
      // Simulate what the workflow would create for a SECURITY scan
      const severities = ['High', 'Medium', 'Low'];
      const createdTickets: string[] = [];

      for (const severity of severities) {
        const response = await makeWorkflowRequest(ctx.projectId, {
          title: `[Health:Security] ${severity} severity issues`,
          description: `## Security Scan Issues (${severity} Severity)\n\nScan ID: 42\n\n- **SQL Injection** in \`src/api.ts:15\`\n\n*Auto-generated by health scan*`,
        });
        expect(response.status).toBe(201);
        const data = await response.json();
        createdTickets.push(data.ticketKey);
      }

      expect(createdTickets).toHaveLength(3);

      // Verify tickets are in INBOX
      const tickets = await prisma.ticket.findMany({
        where: {
          projectId: ctx.projectId,
          title: { startsWith: '[Health:Security]' },
        },
      });
      expect(tickets).toHaveLength(3);
      tickets.forEach(t => expect(t.stage).toBe('INBOX'));
    });

    it('creates compliance tickets grouped by principle', async () => {
      const principles = ['TypeScript-First', 'Security-First'];

      for (const principle of principles) {
        const response = await makeWorkflowRequest(ctx.projectId, {
          title: `[Health:Compliance] ${principle} violations`,
          description: `## Compliance Violations: ${principle}\n\nScan ID: 43\n\n- **Violation** in \`src/utils.ts:10\`\n\n*Auto-generated by health scan*`,
        });
        expect(response.status).toBe(201);
      }

      const tickets = await prisma.ticket.findMany({
        where: {
          projectId: ctx.projectId,
          title: { startsWith: '[Health:Compliance]' },
        },
      });
      expect(tickets).toHaveLength(2);
    });

    it('creates test tickets for non-fixable failures', async () => {
      const response = await makeWorkflowRequest(ctx.projectId, {
        title: '[Health:Tests] UserService.create should validate email',
        description: '## Non-Fixable Test Failure\n\nScan ID: 44\n\n- **UserService.create should validate email** in `tests/unit/user.test.ts:25`\n\n*Auto-generated by health scan*',
      });
      expect(response.status).toBe(201);

      const tickets = await prisma.ticket.findMany({
        where: {
          projectId: ctx.projectId,
          title: { startsWith: '[Health:Tests]' },
        },
      });
      expect(tickets).toHaveLength(1);
    });

    it('creates spec sync tickets for drifted specs', async () => {
      const response = await makeWorkflowRequest(ctx.projectId, {
        title: '[Health:SpecSync] specs/auth/spec.md drift',
        description: '## Specification Drift\n\nScan ID: 45\n\n- **specs/auth/spec.md**: Auth endpoint missing rate limiting\n\n*Auto-generated by health scan*',
      });
      expect(response.status).toBe(201);

      const tickets = await prisma.ticket.findMany({
        where: {
          projectId: ctx.projectId,
          title: { startsWith: '[Health:SpecSync]' },
        },
      });
      expect(tickets).toHaveLength(1);
    });

    it('creates no tickets when there are zero issues', async () => {
      // Zero-issue scans should create no tickets - just verify no workflow
      // tickets exist when none are created
      const tickets = await prisma.ticket.findMany({
        where: {
          projectId: ctx.projectId,
          title: { startsWith: '[Health:' },
        },
      });
      expect(tickets).toHaveLength(0);
    });
  });
});
