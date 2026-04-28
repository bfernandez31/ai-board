import { NextRequest } from 'next/server';
import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Stage } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

vi.mock('@/lib/ai-credentials/workflow', () => ({
  getOwnerCredential: vi.fn(),
  getMissingCredentialError: () => 'No Anthropic credential configured.',
}));

const dispatchMock = vi.fn(async () => undefined);
vi.mock('@/lib/analysis/dispatch-analysis', () => ({
  dispatchInboxAnalysisWorkflow: (...args: unknown[]) => dispatchMock(...args),
}));

import { POST, GET } from '@/app/api/projects/[projectId]/tickets/[id]/analysis/route';
import { getOwnerCredential } from '@/lib/ai-credentials/workflow';

const ownerCredentialMock = vi.mocked(getOwnerCredential);

describe('POST /api/projects/:projectId/tickets/:id/analysis', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    dispatchMock.mockReset().mockResolvedValue(undefined);
    ownerCredentialMock.mockReset();
    ownerCredentialMock.mockResolvedValue({
      id: 1,
      userId: 'fake',
      provider: 'ANTHROPIC',
    } as unknown as Awaited<ReturnType<typeof getOwnerCredential>>);
  });

  async function createInboxTicket(ticketNumber = 800) {
    const ticket = await ctx.createTicket({
      title: `[e2e] analysis ${ticketNumber}`,
      description: 'Add an export-to-csv button to the dashboard.',
      stage: Stage.INBOX,
    });
    return ticket;
  }

  function postRequest(projectId: number, ticketId: number, headers: Record<string, string> = {}) {
    return POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/tickets/${ticketId}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ctx.api.getHeaders(), ...headers },
        body: '{}',
      }),
      {
        params: Promise.resolve({
          projectId: String(projectId),
          id: String(ticketId),
        }),
      }
    );
  }

  it('creates a running row, populates snapshot + anchorIdsAttempted, returns 202', async () => {
    const ticket = await createInboxTicket(801);
    const res = await postRequest(ctx.projectId, ticket.id);
    expect(res.status).toBe(202);
    const body = (await res.json()) as { analysis: { id: number; status: string } };
    expect(body.analysis.status).toBe('running');

    const row = await prisma.ticketAnalysis.findUnique({ where: { id: body.analysis.id } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe('running');
    expect(row!.titleSnapshot).toContain('analysis 801');
    expect(row!.descriptionSnapshot).toContain('export-to-csv');
    expect(Array.isArray(row!.anchorIdsAttempted)).toBe(true);
  });

  it('persists stack snapshot for two distinct configurations (FR-016 / FR-022)', async () => {
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        config: {
          version: 1,
          project: { name: 'demo', language: 'python', framework: 'fastapi' },
          runtime: { manager: 'pip' },
          services: [{ type: 'postgres', version: '14' }],
          testing: { framework: 'pytest', e2e: false },
          commands: { install: 'pip install -r requirements.txt' },
          env: {},
          agent: { cli: 'claude-code' },
        },
      },
    });
    const ticket = await createInboxTicket(802);
    const res = await postRequest(ctx.projectId, ticket.id);
    expect(res.status).toBe(202);
    const body = (await res.json()) as { analysis: { id: number } };
    const row = await prisma.ticketAnalysis.findUnique({ where: { id: body.analysis.id } });
    const snap = row!.stackSnapshot as unknown as { language: string; framework: string };
    expect(snap.language).toBe('python');
    expect(snap.framework).toBe('fastapi');

    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        config: {
          version: 1,
          project: { name: 'demo', language: 'typescript', framework: 'nextjs' },
          runtime: { manager: 'bun' },
          services: [{ type: 'postgres', version: '14' }],
          testing: { framework: 'vitest', e2e: true, e2e_framework: 'playwright' },
          commands: { install: 'bun install' },
          env: {},
          agent: { cli: 'claude-code' },
        },
      },
    });
    const ticket2 = await createInboxTicket(803);
    const res2 = await postRequest(ctx.projectId, ticket2.id);
    const body2 = (await res2.json()) as { analysis: { id: number } };
    const row2 = await prisma.ticketAnalysis.findUnique({ where: { id: body2.analysis.id } });
    const snap2 = row2!.stackSnapshot as unknown as { language: string; framework: string };
    expect(snap2.language).toBe('typescript');
    expect(snap2.framework).toBe('nextjs');
  });

  it('returns 422 STAGE_NOT_INBOX for non-INBOX tickets', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] non-inbox',
      description: 'x',
      stage: Stage.SPECIFY,
    });
    const res = await postRequest(ctx.projectId, ticket.id);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('STAGE_NOT_INBOX');
  });

  it('returns 412 CREDENTIAL_MISSING when owner has no credential — no row created', async () => {
    ownerCredentialMock.mockResolvedValueOnce(null);
    const ticket = await createInboxTicket(805);
    const before = await prisma.ticketAnalysis.count({ where: { ticketId: ticket.id } });
    const res = await postRequest(ctx.projectId, ticket.id);
    expect(res.status).toBe(412);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CREDENTIAL_MISSING');
    const after = await prisma.ticketAnalysis.count({ where: { ticketId: ticket.id } });
    expect(after).toBe(before);
  });

  it('marks row failed and returns 5xx when dispatch throws', async () => {
    dispatchMock.mockRejectedValueOnce(new Error('upstream blew up'));
    const ticket = await createInboxTicket(806);
    const res = await postRequest(ctx.projectId, ticket.id);
    expect(res.status).toBe(500);
    const row = await prisma.ticketAnalysis.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(row?.status).toBe('failed');
    expect(row?.errorReason).toBe('dispatch_failed');
  });

  it('TEST_MODE=true short-circuits dispatch and leaves row running', async () => {
    const ticket = await createInboxTicket(807);
    const res = await postRequest(ctx.projectId, ticket.id);
    expect(res.status).toBe(202);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as { analysis: { id: number } };
    const row = await prisma.ticketAnalysis.findUnique({ where: { id: body.analysis.id } });
    expect(row?.status).toBe('running');
  });
});

describe('GET /api/projects/:projectId/tickets/:id/analysis (eligibility)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    ownerCredentialMock.mockReset();
    ownerCredentialMock.mockResolvedValue({
      id: 1,
      userId: 'fake',
      provider: 'ANTHROPIC',
    } as unknown as Awaited<ReturnType<typeof getOwnerCredential>>);
  });

  it('returns triggerable=true and a USD cost range for an INBOX ticket', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] eligibility',
      description: 'x',
      stage: Stage.INBOX,
    });
    const res = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis`,
        { headers: ctx.api.getHeaders() }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticket.id),
        }),
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      latest: unknown;
      eligibility: { triggerable: boolean; estimatedCostUsd: { lower: number; upper: number } };
    };
    expect(body.eligibility.triggerable).toBe(true);
    expect(body.eligibility.estimatedCostUsd.lower).toBeGreaterThan(0);
    expect(body.eligibility.estimatedCostUsd.upper).toBeGreaterThanOrEqual(
      body.eligibility.estimatedCostUsd.lower
    );
  });
});
