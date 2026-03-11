import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import {
  otlpLogsSchema,
  findAttribute,
  parseIntAttribute,
  parseFloatAttribute,
} from '@/lib/schemas/otlp';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';

/**
 * POST /api/telemetry/v1/logs
 *
 * OTLP HTTP JSON endpoint for receiving agent telemetry (Claude Code and Codex).
 * Aggregates metrics from log records and updates the corresponding Job.
 *
 * The job_id must be passed via OTEL_RESOURCE_ATTRIBUTES="job_id=123"
 * in the workflow environment.
 *
 * Expected OTLP format:
 * {
 *   "resourceLogs": [{
 *     "resource": {
 *       "attributes": [
 *         { "key": "job_id", "value": { "stringValue": "123" } },
 *         { "key": "service.name", "value": { "stringValue": "claude-code" } }
 *       ]
 *     },
 *     "scopeLogs": [{
 *       "logRecords": [{
 *         "body": { "stringValue": "claude_code.api_request" },
 *         "attributes": [
 *           { "key": "input_tokens", "value": { "stringValue": "1000" } },
 *           { "key": "output_tokens", "value": { "stringValue": "500" } },
 *           { "key": "cost_usd", "value": { "stringValue": "0.05" } }
 *         ]
 *       }]
 *     }]
 *   }]
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let jobId: number | undefined;

  try {
    // Validate workflow authentication
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      console.error('[OTLP Telemetry] Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[OTLP Telemetry] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate OTLP schema
    const validationResult = otlpLogsSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('[OTLP Telemetry] Schema validation failed:', {
        errors: validationResult.error.issues,
        receivedKeys: Object.keys(body || {}),
        bodyPreview: JSON.stringify(body).slice(0, 500),
      });
      return NextResponse.json(
        { error: 'Invalid OTLP format' },
        { status: 400 }
      );
    }

    const otlpData = validationResult.data;

    // Aggregate metrics from all resource logs
    const metrics = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0,
      durationMs: 0,
      model: null as string | null,
      toolsUsed: new Set<string>(),
    };

    // Process each resourceLog
    for (const resourceLog of otlpData.resourceLogs) {
      // Extract job_id from resource attributes
      const resourceAttrs = resourceLog.resource?.attributes;
      const jobIdAttr = findAttribute(resourceAttrs, 'job_id');

      if (jobIdAttr && !jobId) {
        jobId = parseInt(String(jobIdAttr), 10);
        if (isNaN(jobId)) {
          console.error('[OTLP Telemetry] Invalid job_id:', jobIdAttr);
          jobId = undefined;
        }
      }

      // Process scope logs
      for (const scopeLog of resourceLog.scopeLogs || []) {
        for (const logRecord of scopeLog.logRecords || []) {
          const eventName = logRecord.body?.stringValue;
          const attrs = logRecord.attributes;

          const isApiRequest = ['claude_code.api_request', 'codex.api_request'].includes(eventName ?? '');
          const isToolEvent = ['claude_code.tool_result', 'claude_code.tool_decision', 'codex.tool.call'].includes(eventName ?? '');

          if (isApiRequest) {
            metrics.inputTokens += parseIntAttribute(findAttribute(attrs, 'input_tokens'));
            metrics.outputTokens += parseIntAttribute(findAttribute(attrs, 'output_tokens'));
            metrics.cacheReadTokens += parseIntAttribute(findAttribute(attrs, 'cache_read_tokens'));
            metrics.cacheCreationTokens += parseIntAttribute(findAttribute(attrs, 'cache_creation_tokens'));
            metrics.costUsd += parseFloatAttribute(findAttribute(attrs, 'cost_usd'));
            metrics.durationMs += parseIntAttribute(findAttribute(attrs, 'duration_ms'));
            const model = findAttribute(attrs, 'model');
            if (model) metrics.model = String(model);
          }

          if (isToolEvent) {
            const toolName = findAttribute(attrs, 'tool_name');
            if (toolName) metrics.toolsUsed.add(String(toolName));
          }
        }
      }
    }

    // If no job_id found, return success but don't store (allows telemetry without job tracking)
    if (!jobId) {
      console.warn('[OTLP Telemetry] No job_id in resource attributes, metrics not stored');
      return NextResponse.json({
        status: 'accepted',
        message: 'Telemetry received but no job_id found in resource attributes'
      }, { status: 200 });
    }

    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheCreationTokens: true,
        costUsd: true,
        durationMs: true,
        toolsUsed: true,
      },
    });

    if (!job) {
      console.error('[OTLP Telemetry] Job not found:', { jobId });
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Merge and deduplicate tools in memory to avoid a second DB call
    const mergedTools = [...new Set([...job.toolsUsed, ...metrics.toolsUsed])].sort();

    // Aggregate with existing metrics (OTLP may send multiple batches)
    const updateData: Parameters<typeof prisma.job.update>[0]['data'] = {
      inputTokens: (job.inputTokens || 0) + metrics.inputTokens,
      outputTokens: (job.outputTokens || 0) + metrics.outputTokens,
      cacheReadTokens: (job.cacheReadTokens || 0) + metrics.cacheReadTokens,
      cacheCreationTokens: (job.cacheCreationTokens || 0) + metrics.cacheCreationTokens,
      costUsd: (job.costUsd || 0) + metrics.costUsd,
      durationMs: (job.durationMs || 0) + metrics.durationMs,
      toolsUsed: mergedTools,
    };

    if (metrics.model) {
      updateData.model = metrics.model;
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      select: {
        id: true,
        inputTokens: true,
        outputTokens: true,
        costUsd: true,
      },
    });

    const elapsedTime = Date.now() - startTime;
    console.log('[OTLP Telemetry] Success:', {
      jobId,
      inputTokens: updatedJob.inputTokens,
      outputTokens: updatedJob.outputTokens,
      costUsd: updatedJob.costUsd,
      toolsCount: metrics.toolsUsed.size,
      elapsedMs: elapsedTime,
    });

    return NextResponse.json({
      status: 'accepted',
      jobId,
      metrics: {
        inputTokens: updatedJob.inputTokens,
        outputTokens: updatedJob.outputTokens,
        costUsd: updatedJob.costUsd,
      }
    }, { status: 200 });

  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;

    console.error('[OTLP Telemetry] Unexpected error:', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      elapsedMs: elapsedTime,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
