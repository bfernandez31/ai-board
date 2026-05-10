import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import {
  deleteAllInsightsReports,
  seedRunningInsightsReport,
  seedCompletedInsightsReport,
} from '@/tests/helpers/admin-insights-fixtures';

const WORKFLOW_TOKEN =
  process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
const BASE_URL =
  process.env.TEST_BASE_URL || 'http://localhost:3000';

function workflowClient(): APIClient {
  return createAPIClient({
    includeTestUserHeader: false,
    enableTestAuthOverride: false,
    defaultHeaders: { Authorization: `Bearer ${WORKFLOW_TOKEN}` },
  });
}

async function putHtml(
  reportId: number,
  body: string,
  contentType = 'text/html; charset=utf-8'
): Promise<Response> {
  return fetch(`${BASE_URL}/api/admin/insights/reports/${reportId}/html`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
      'Content-Type': contentType,
      'Content-Length': String(Buffer.byteLength(body, 'utf-8')),
    },
    body,
  });
}

describe('PUT /api/admin/insights/reports/:id/html', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await deleteAllInsightsReports();
  });

  afterEach(async () => {
    await deleteAllInsightsReports();
  });

  it('returns 401 without Bearer token', async () => {
    const r = await fetch(`${BASE_URL}/api/admin/insights/reports/1/html`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: '<html></html>',
    });
    expect(r.status).toBe(401);
  });

  it('returns 415 for wrong Content-Type', async () => {
    const row = await seedRunningInsightsReport();
    const r = await putHtml(row.id, '<html></html>', 'application/json');
    expect(r.status).toBe(415);
  });

  it('returns 404 for unknown id', async () => {
    const r = await putHtml(999999, '<html></html>');
    expect(r.status).toBe(404);
  });

  it('returns 409 when row is already terminal', async () => {
    const row = await seedCompletedInsightsReport();
    const r = await putHtml(row.id, '<html></html>');
    expect(r.status).toBe(409);
  });

  it('returns 201 with htmlBlobKey/htmlBlobSize on success', async () => {
    const row = await seedRunningInsightsReport();
    const body = '<html><body>Hello</body></html>';
    const r = await putHtml(row.id, body);
    expect(r.status).toBe(201);
    const json = (await r.json()) as {
      htmlBlobKey: string;
      htmlBlobSize: number;
    };
    expect(json.htmlBlobKey).toBe(`insights/reports/${row.id}.html`);
    expect(json.htmlBlobSize).toBe(Buffer.byteLength(body, 'utf-8'));
    // Row should NOT be mutated by the PUT — the COMPLETED PATCH writes the
    // pointer authoritatively.
    const after = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(after?.htmlBlobKey).toBeNull();
  });

  it('allows idempotent re-upload while RUNNING', async () => {
    const row = await seedRunningInsightsReport();
    const body = '<html><body>v1</body></html>';
    const r1 = await putHtml(row.id, body);
    expect(r1.status).toBe(201);
    const r2 = await putHtml(row.id, body);
    expect(r2.status).toBe(201);
  });
});
