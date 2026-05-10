import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { adminMock, scopeMock, prismaMock, dispatchMock } = vi.hoisted(() => ({
  adminMock: { requireAdmin: vi.fn() },
  scopeMock: {
    buildInsightsScope: vi.fn(),
    findActiveInsightsReport: vi.fn(),
  },
  prismaMock: {
    insightsReport: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  dispatchMock: { dispatchAdminInsightsWorkflow: vi.fn() },
}));

vi.mock('@/lib/auth/admin', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/admin')>('@/lib/auth/admin');
  return { ...actual, requireAdmin: adminMock.requireAdmin };
});

vi.mock('@/lib/admin/insights-scope', () => scopeMock);
vi.mock('@/lib/db/client', () => ({ prisma: prismaMock }));
vi.mock('@/lib/workflows/dispatch-admin-insights', () => dispatchMock);

import { POST } from '@/app/api/admin/insights/run/route';
import { AdminAccessDeniedError } from '@/lib/auth/admin';

const ADMIN = { id: 'admin-user', email: 'admin@example.com' };

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/insights/run', {
    method: 'POST',
  });
}

describe('POST /api/admin/insights/run', () => {
  beforeEach(() => {
    adminMock.requireAdmin.mockReset();
    scopeMock.buildInsightsScope.mockReset();
    scopeMock.findActiveInsightsReport.mockReset();
    prismaMock.insightsReport.create.mockReset();
    prismaMock.insightsReport.update.mockReset();
    dispatchMock.dispatchAdminInsightsWorkflow.mockReset();
  });

  it('returns 404 for non-admin callers without leaking the area', async () => {
    adminMock.requireAdmin.mockRejectedValueOnce(new AdminAccessDeniedError());

    const res = await POST(makeRequest());

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(scopeMock.findActiveInsightsReport).not.toHaveBeenCalled();
  });

  it('refuses to start a second run when one is already in flight', async () => {
    adminMock.requireAdmin.mockResolvedValueOnce(ADMIN);
    scopeMock.findActiveInsightsReport.mockResolvedValueOnce({ id: 42 });

    const res = await POST(makeRequest());

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      code: 'ANALYSIS_IN_PROGRESS',
      activeReportId: 42,
    });
    expect(scopeMock.buildInsightsScope).not.toHaveBeenCalled();
    expect(prismaMock.insightsReport.create).not.toHaveBeenCalled();
  });

  it('refuses with a friendly message when no new tickets shipped', async () => {
    adminMock.requireAdmin.mockResolvedValueOnce(ADMIN);
    scopeMock.findActiveInsightsReport.mockResolvedValueOnce(null);
    const previousRunAt = new Date('2026-05-01T12:00:00Z');
    scopeMock.buildInsightsScope.mockResolvedValueOnce({
      previousRunAt,
      newTicketCount: 0,
      hasNewTickets: false,
      periodStart: previousRunAt,
      periodEnd: new Date('2026-05-10T00:00:00Z'),
      ticketIds: [],
      jobs: [],
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('NO_NEW_TICKETS');
    expect(body.previousRunAt).toBe(previousRunAt.toISOString());
    expect(body.error).toContain('No new shipped tickets since last run on');
    expect(prismaMock.insightsReport.create).not.toHaveBeenCalled();
    expect(dispatchMock.dispatchAdminInsightsWorkflow).not.toHaveBeenCalled();
  });

  it('creates a RUNNING report and dispatches the workflow when new tickets exist', async () => {
    adminMock.requireAdmin.mockResolvedValueOnce(ADMIN);
    scopeMock.findActiveInsightsReport.mockResolvedValueOnce(null);
    const now = new Date('2026-05-10T00:00:00Z');
    scopeMock.buildInsightsScope.mockResolvedValueOnce({
      previousRunAt: null,
      newTicketCount: 4,
      hasNewTickets: true,
      periodStart: new Date('2026-04-01T00:00:00Z'),
      periodEnd: now,
      ticketIds: [1, 2, 3, 4],
      jobs: [
        {
          jobId: 9001,
          projectId: 3,
          ticketId: 1,
          rawArtifactKey: 'raw-logs/3/1/9001.jsonl.gz',
        },
        {
          jobId: 9002,
          projectId: 3,
          ticketId: 2,
          rawArtifactKey: 'raw-logs/3/2/9002.jsonl.gz',
        },
      ],
    });
    prismaMock.insightsReport.create.mockResolvedValueOnce({
      id: 17,
      status: 'RUNNING',
      sessionCount: 2,
      ticketCount: 4,
      periodStart: new Date('2026-04-01T00:00:00Z'),
      periodEnd: now,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      reportId: 17,
      status: 'RUNNING',
      sessionCount: 2,
      ticketCount: 4,
    });
    expect(prismaMock.insightsReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'RUNNING',
        triggeredById: ADMIN.id,
        sessionCount: 2,
        ticketCount: 4,
        periodEnd: now,
      }),
    });
    expect(dispatchMock.dispatchAdminInsightsWorkflow).toHaveBeenCalledWith({
      report_id: '17',
    });
  });

  it('marks the report FAILED when workflow dispatch errors', async () => {
    adminMock.requireAdmin.mockResolvedValueOnce(ADMIN);
    scopeMock.findActiveInsightsReport.mockResolvedValueOnce(null);
    scopeMock.buildInsightsScope.mockResolvedValueOnce({
      previousRunAt: null,
      newTicketCount: 1,
      hasNewTickets: true,
      periodStart: new Date('2026-04-01T00:00:00Z'),
      periodEnd: new Date('2026-05-10T00:00:00Z'),
      ticketIds: [1],
      jobs: [],
    });
    prismaMock.insightsReport.create.mockResolvedValueOnce({ id: 99 });
    dispatchMock.dispatchAdminInsightsWorkflow.mockRejectedValueOnce(
      new Error('boom')
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeRequest());
    errorSpy.mockRestore();

    expect(res.status).toBe(500);
    expect(prismaMock.insightsReport.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'boom',
      }),
    });
  });
});
