import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import {
  deleteAllInsightsReports,
  seedRunningInsightsReport,
  seedCompletedInsightsReport,
  seedFailedInsightsReport,
} from '@/tests/helpers/admin-insights-fixtures';

const WORKFLOW_TOKEN =
  process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function makeWorkflowClient(): APIClient {
  return createAPIClient({
    includeTestUserHeader: false,
    enableTestAuthOverride: false,
    defaultHeaders: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('PATCH /api/admin/insights/reports/:id/status', () => {
  let ctx: TestContext;
  let workflow: APIClient;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflow = makeWorkflowClient();
    await ctx.cleanup();
    await deleteAllInsightsReports();
  });

  afterEach(async () => {
    await deleteAllInsightsReports();
  });

  it('returns 401 without Bearer token', async () => {
    const noAuth = createAPIClient({
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });
    const r = await noAuth.patch(
      '/api/admin/insights/reports/1/status',
      { status: 'RUNNING' }
    );
    expect(r.status).toBe(401);
  });

  it('returns 404 for unknown id', async () => {
    const r = await workflow.patch('/api/admin/insights/reports/999999/status', {
      status: 'RUNNING',
    });
    expect(r.status).toBe(404);
  });

  it('RUNNING idempotent: returns 200 with current state and writes workflowRunId', async () => {
    const row = await seedRunningInsightsReport();
    const r = await workflow.patch<{ status: string }>(
      `/api/admin/insights/reports/${row.id}/status`,
      { status: 'RUNNING', workflowRunId: 1234 }
    );
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('RUNNING');
    const after = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(after?.workflowRunId?.toString()).toBe('1234');
  });

  it('RUNNING -> COMPLETED transitions and persists counts/blob pointer', async () => {
    const row = await seedRunningInsightsReport();
    const r = await workflow.patch<{ status: string; completedAt: string | null }>(
      `/api/admin/insights/reports/${row.id}/status`,
      {
        status: 'COMPLETED',
        sessionsCount: 9,
        ticketsCount: 3,
        htmlBlobKey: `insights/reports/${row.id}.html`,
        htmlBlobSize: 1024,
      }
    );
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('COMPLETED');
    expect(r.data.completedAt).not.toBeNull();
    const after = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(after?.status).toBe('COMPLETED');
    expect(after?.sessionsCount).toBe(9);
    expect(after?.ticketsCount).toBe(3);
    expect(after?.htmlBlobKey).toBe(`insights/reports/${row.id}.html`);
    expect(after?.htmlBlobSize).toBe(1024);
  });

  it('RUNNING -> FAILED transitions with errorReason', async () => {
    const row = await seedRunningInsightsReport();
    const r = await workflow.patch<{ status: string }>(
      `/api/admin/insights/reports/${row.id}/status`,
      { status: 'FAILED', errorReason: 'CLI exited non-zero' }
    );
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('FAILED');
    const after = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(after?.status).toBe('FAILED');
    expect(after?.errorReason).toBe('CLI exited non-zero');
  });

  it('rejects invalid transitions from terminal states (COMPLETED -> FAILED) returns 400', async () => {
    const row = await seedCompletedInsightsReport();
    const r = await workflow.patch<{ error: string }>(
      `/api/admin/insights/reports/${row.id}/status`,
      { status: 'FAILED', errorReason: 'after the fact' }
    );
    expect(r.status).toBe(400);
  });

  it('idempotent same-status from a terminal state returns 200', async () => {
    const row = await seedCompletedInsightsReport();
    const r = await workflow.patch<{ status: string }>(
      `/api/admin/insights/reports/${row.id}/status`,
      {
        status: 'COMPLETED',
        sessionsCount: 1,
        ticketsCount: 1,
        htmlBlobKey: `insights/reports/${row.id}.html`,
        htmlBlobSize: 12,
      }
    );
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('COMPLETED');
  });

  it('rejects an invalid Zod body with 400', async () => {
    const row = await seedRunningInsightsReport();
    const r = await workflow.patch<{ error: string }>(
      `/api/admin/insights/reports/${row.id}/status`,
      { status: 'COMPLETED' /* missing required fields */ }
    );
    expect(r.status).toBe(400);
    expect(r.data).toHaveProperty('error');
  });

  it('duplicate terminal callbacks do not double-finalize', async () => {
    const row = await seedRunningInsightsReport();
    const a = await workflow.patch(
      `/api/admin/insights/reports/${row.id}/status`,
      { status: 'FAILED', errorReason: 'first' }
    );
    expect(a.status).toBe(200);
    const b = await workflow.patch(
      `/api/admin/insights/reports/${row.id}/status`,
      { status: 'FAILED', errorReason: 'second' }
    );
    // Idempotent same-status second call.
    expect(b.status).toBe(200);
    const after = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(after?.errorReason).toBe('first');
  });
});
