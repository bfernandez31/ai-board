/**
 * Integration Tests: Agent-Agnostic Telemetry Endpoint
 *
 * Tests that POST /api/telemetry/v1/logs correctly processes both
 * Claude Code and Codex OTLP events, accumulates metrics, and
 * handles edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

function buildOtlpPayload(
  jobId: number,
  logRecords: Array<{ body: { stringValue: string }; attributes?: Array<{ key: string; value: Record<string, unknown> }> }>
) {
  return {
    resourceLogs: [{
      resource: {
        attributes: [
          { key: 'job_id', value: { stringValue: String(jobId) } },
        ],
      },
      scopeLogs: [{
        logRecords,
      }],
    }],
  };
}

describe('Agent-Agnostic Telemetry', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    // Create a test ticket and transition to get a job
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Telemetry Agent-Agnostic Test',
        description: 'Test ticket for agent-agnostic telemetry',
      }
    );
    ticketId = createResponse.data.id;

    await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
      targetStage: 'SPECIFY',
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: { orderBy: { createdAt: 'desc' } } },
    });
    jobId = ticket!.jobs[0]!.id;

    // Set job to RUNNING so telemetry can be received
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
  });

  describe('US1: Codex Telemetry Ingestion', () => {
    it('T004: Codex sse_event (response.completed) updates Job with correct token metrics', async () => {
      const payload = buildOtlpPayload(jobId, [{
        body: { stringValue: 'codex.sse_event' },
        attributes: [
          { key: 'event.kind', value: { stringValue: 'response.completed' } },
          { key: 'input_token_count', value: { stringValue: '500' } },
          { key: 'output_token_count', value: { stringValue: '200' } },
          { key: 'cached_token_count', value: { stringValue: '100' } },
          { key: 'model', value: { stringValue: 'codex-mini-latest' } },
        ],
      }]);

      const response = await workflowApi.post('/api/telemetry/v1/logs', payload);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'accepted');

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      // Codex input_token_count (500) includes cached (100), so non-cached = 400
      expect(job!.inputTokens).toBe(400);
      expect(job!.outputTokens).toBe(200);
      expect(job!.cacheReadTokens).toBe(100);
      // Cost is estimated from OpenAI pricing, not reported directly
      expect(job!.costUsd).toBeGreaterThan(0);
      expect(job!.model).toBe('codex-mini-latest');
    });

    it('T005: Codex tool_result event adds tool names to Job toolsUsed', async () => {
      const payload = buildOtlpPayload(jobId, [
        {
          body: { stringValue: 'codex.tool_result' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'shell' } },
          ],
        },
        {
          body: { stringValue: 'codex.tool_decision' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'file_read' } },
          ],
        },
      ]);

      const response = await workflowApi.post('/api/telemetry/v1/logs', payload);
      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.toolsUsed).toContain('shell');
      expect(job!.toolsUsed).toContain('file_read');
    });

    it('T006: multiple Codex batches accumulate metrics correctly', async () => {
      // First batch
      const payload1 = buildOtlpPayload(jobId, [
        {
          body: { stringValue: 'codex.sse_event' },
          attributes: [
            { key: 'event.kind', value: { stringValue: 'response.completed' } },
            { key: 'input_token_count', value: { stringValue: '300' } },
            { key: 'output_token_count', value: { stringValue: '100' } },
            { key: 'cached_token_count', value: { stringValue: '0' } },
          ],
        },
        {
          body: { stringValue: 'codex.tool_result' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'shell' } },
          ],
        },
      ]);

      await workflowApi.post('/api/telemetry/v1/logs', payload1);

      // Second batch
      const payload2 = buildOtlpPayload(jobId, [
        {
          body: { stringValue: 'codex.sse_event' },
          attributes: [
            { key: 'event.kind', value: { stringValue: 'response.completed' } },
            { key: 'input_token_count', value: { stringValue: '200' } },
            { key: 'output_token_count', value: { stringValue: '150' } },
            { key: 'cached_token_count', value: { stringValue: '0' } },
          ],
        },
        {
          body: { stringValue: 'codex.tool_result' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'shell' } },  // duplicate - should be deduped
          ],
        },
        {
          body: { stringValue: 'codex.tool_decision' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'file_write' } },
          ],
        },
      ]);

      await workflowApi.post('/api/telemetry/v1/logs', payload2);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.inputTokens).toBe(500);  // 300 + 200
      expect(job!.outputTokens).toBe(250); // 100 + 150
      // Cost is estimated, just verify it accumulated
      expect(job!.costUsd).toBeGreaterThan(0);
      // Tools should be deduplicated
      const uniqueTools = [...new Set(job!.toolsUsed)];
      expect(uniqueTools).toHaveLength(job!.toolsUsed.length);
      expect(job!.toolsUsed).toContain('shell');
      expect(job!.toolsUsed).toContain('file_write');
    });

    it('T007: missing attributes in Codex events default to zero', async () => {
      const payload = buildOtlpPayload(jobId, [{
        body: { stringValue: 'codex.sse_event' },
        attributes: [
          { key: 'event.kind', value: { stringValue: 'response.completed' } },
          // Only input_token_count provided, others missing
          { key: 'input_token_count', value: { stringValue: '100' } },
        ],
      }]);

      const response = await workflowApi.post('/api/telemetry/v1/logs', payload);
      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.inputTokens).toBe(100);
      expect(job!.outputTokens).toBe(0);
      expect(job!.cacheReadTokens).toBe(0);
    });
  });

  describe('US2: Claude Telemetry Backward Compatibility', () => {
    it('T008: Claude api_request events still update Job with token counts, cost, duration, and model', async () => {
      const payload = buildOtlpPayload(jobId, [{
        body: { stringValue: 'claude_code.api_request' },
        attributes: [
          { key: 'input_tokens', value: { stringValue: '1000' } },
          { key: 'output_tokens', value: { stringValue: '500' } },
          { key: 'cache_read_tokens', value: { stringValue: '200' } },
          { key: 'cache_creation_tokens', value: { stringValue: '100' } },
          { key: 'cost_usd', value: { stringValue: '0.05' } },
          { key: 'duration_ms', value: { stringValue: '2000' } },
          { key: 'model', value: { stringValue: 'claude-sonnet-4-6-20250514' } },
        ],
      }]);

      const response = await workflowApi.post('/api/telemetry/v1/logs', payload);
      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.inputTokens).toBe(1000);
      expect(job!.outputTokens).toBe(500);
      expect(job!.cacheReadTokens).toBe(200);
      expect(job!.cacheCreationTokens).toBe(100);
      expect(job!.costUsd).toBeCloseTo(0.05);
      expect(job!.durationMs).toBe(2000);
      expect(job!.model).toBe('claude-sonnet-4-6-20250514');
    });

    it('T009: Claude tool_result and tool_decision events still track tool usage', async () => {
      const payload = buildOtlpPayload(jobId, [
        {
          body: { stringValue: 'claude_code.tool_result' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'Read' } },
          ],
        },
        {
          body: { stringValue: 'claude_code.tool_decision' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'Write' } },
          ],
        },
        {
          body: { stringValue: 'claude_code.tool_result' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'Bash' } },
          ],
        },
      ]);

      const response = await workflowApi.post('/api/telemetry/v1/logs', payload);
      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.toolsUsed).toContain('Read');
      expect(job!.toolsUsed).toContain('Write');
      expect(job!.toolsUsed).toContain('Bash');
    });
  });

  describe('US3: Agent-Distinguishable Analytics', () => {
    it('T010: mixed Claude + Codex events in same payload accumulate correctly', async () => {
      const payload = buildOtlpPayload(jobId, [
        {
          body: { stringValue: 'claude_code.api_request' },
          attributes: [
            { key: 'input_tokens', value: { stringValue: '500' } },
            { key: 'output_tokens', value: { stringValue: '200' } },
            { key: 'cost_usd', value: { stringValue: '0.02' } },
          ],
        },
        {
          body: { stringValue: 'codex.sse_event' },
          attributes: [
            { key: 'event.kind', value: { stringValue: 'response.completed' } },
            { key: 'input_token_count', value: { stringValue: '300' } },
            { key: 'output_token_count', value: { stringValue: '100' } },
            { key: 'cached_token_count', value: { stringValue: '0' } },
          ],
        },
        {
          body: { stringValue: 'claude_code.tool_result' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'Read' } },
          ],
        },
        {
          body: { stringValue: 'codex.tool_result' },
          attributes: [
            { key: 'tool_name', value: { stringValue: 'shell' } },
          ],
        },
      ]);

      const response = await workflowApi.post('/api/telemetry/v1/logs', payload);
      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.inputTokens).toBe(800);  // 500 + 300
      expect(job!.outputTokens).toBe(300); // 200 + 100
      // Cost includes Claude's exact cost + Codex's estimated cost
      expect(job!.costUsd).toBeGreaterThan(0.02);
      expect(job!.toolsUsed).toContain('Read');
      expect(job!.toolsUsed).toContain('shell');
    });

    it('T011: Codex sse_event populates model field with Codex model name', async () => {
      const payload = buildOtlpPayload(jobId, [{
        body: { stringValue: 'codex.sse_event' },
        attributes: [
          { key: 'event.kind', value: { stringValue: 'response.completed' } },
          { key: 'input_token_count', value: { stringValue: '100' } },
          { key: 'output_token_count', value: { stringValue: '50' } },
          { key: 'cached_token_count', value: { stringValue: '0' } },
          { key: 'model', value: { stringValue: 'codex-mini-latest' } },
        ],
      }]);

      const response = await workflowApi.post('/api/telemetry/v1/logs', payload);
      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.model).toBe('codex-mini-latest');
    });
  });

  describe('Edge Cases', () => {
    it('T014: unrecognized event names are silently skipped without error', async () => {
      const payload = buildOtlpPayload(jobId, [
        {
          body: { stringValue: 'unknown.event.type' },
          attributes: [
            { key: 'input_tokens', value: { stringValue: '999' } },
          ],
        },
        {
          body: { stringValue: 'codex.sse_event' },
          attributes: [
            // sse_event without event.kind = response.completed should be ignored
            { key: 'some_attr', value: { stringValue: 'value' } },
          ],
        },
        {
          body: { stringValue: 'codex.sse_event' },
          attributes: [
            { key: 'event.kind', value: { stringValue: 'response.completed' } },
            { key: 'input_token_count', value: { stringValue: '100' } },
            { key: 'output_token_count', value: { stringValue: '50' } },
            { key: 'cached_token_count', value: { stringValue: '0' } },
          ],
        },
      ]);

      const response = await workflowApi.post('/api/telemetry/v1/logs', payload);
      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      // Only the codex.sse_event with response.completed should have been processed
      expect(job!.inputTokens).toBe(100);
      expect(job!.outputTokens).toBe(50);
    });
  });
});
