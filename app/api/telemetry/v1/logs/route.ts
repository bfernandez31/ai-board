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

    // Log request metadata for debugging
    const contentType = request.headers.get('content-type') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    console.log('[OTLP Telemetry] Request:', { contentType, userAgent });

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      // If JSON parse fails, try reading as text for debugging
      console.error('[OTLP Telemetry] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Debug: log full body structure for non-Claude agents
    if (userAgent.includes('Rust') || userAgent.includes('OTel')) {
      console.log('[OTLP Telemetry] Codex body:', JSON.stringify(body).slice(0, 2000));
    }

    // Ignore traces/metrics that arrive at the logs endpoint (Codex may send all signals here)
    if (body && (body.resourceSpans || body.resource_spans || body.resourceMetrics || body.resource_metrics)) {
      return NextResponse.json({ status: 'accepted', message: 'Traces/metrics ignored at logs endpoint' }, { status: 200 });
    }

    // OTLP protobuf JSON uses snake_case (resource_logs), but our schema expects camelCase (resourceLogs)
    // Normalize snake_case keys to camelCase for compatibility
    if (body && !body.resourceLogs && body.resource_logs) {
      body = normalizeOtlpKeys(body);
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

    // Track OTLP timestamps for Codex duration estimation (Codex doesn't report duration_ms)
    let minCodexTimestampNs = Infinity;
    let maxCodexTimestampNs = -Infinity;

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
          const attrs = logRecord.attributes;
          // Claude uses body.stringValue for event name, Codex uses event.name attribute
          const eventName = logRecord.body?.stringValue
            || String(findAttribute(attrs, 'event.name') ?? '');

          // Claude: token data in claude_code.api_request
          const isClaudeApiRequest = eventName === 'claude_code.api_request';
          // Codex: token data in codex.sse_event with event.kind = "response.completed"
          const eventKind = String(findAttribute(attrs, 'event.kind') ?? '');
          const isCodexTokenEvent = eventName === 'codex.sse_event' && eventKind === 'response.completed';
          const isCodexEvent = eventName.startsWith('codex.');

          const isToolEvent = ['claude_code.tool_result', 'claude_code.tool_decision', 'codex.tool_result', 'codex.tool_decision'].includes(eventName);

          // Track timestamps across ALL Codex events for duration estimation
          // (Codex doesn't report duration_ms; we compute span from first to last event)
          if (isCodexEvent) {
            const tsNano = logRecord.observedTimeUnixNano || logRecord.timeUnixNano;
            if (tsNano) {
              const ns = typeof tsNano === 'string' ? Number(tsNano) : tsNano;
              if (!isNaN(ns) && ns > 0) {
                if (ns < minCodexTimestampNs) minCodexTimestampNs = ns;
                if (ns > maxCodexTimestampNs) maxCodexTimestampNs = ns;
              }
            }
          }

          if (isClaudeApiRequest) {
            metrics.inputTokens += parseIntAttribute(findAttribute(attrs, 'input_tokens'));
            metrics.outputTokens += parseIntAttribute(findAttribute(attrs, 'output_tokens'));
            metrics.cacheReadTokens += parseIntAttribute(findAttribute(attrs, 'cache_read_tokens'));
            metrics.cacheCreationTokens += parseIntAttribute(findAttribute(attrs, 'cache_creation_tokens'));
            metrics.costUsd += parseFloatAttribute(findAttribute(attrs, 'cost_usd'));
            metrics.durationMs += parseIntAttribute(findAttribute(attrs, 'duration_ms'));
            const model = findAttribute(attrs, 'model');
            if (model) metrics.model = String(model);
          }

          if (isCodexTokenEvent) {
            // Codex uses different attribute names for token counts
            const inputTokens = parseIntAttribute(findAttribute(attrs, 'input_token_count'));
            const outputTokens = parseIntAttribute(findAttribute(attrs, 'output_token_count'));
            const cachedTokens = parseIntAttribute(findAttribute(attrs, 'cached_token_count'));
            metrics.inputTokens += inputTokens;
            metrics.outputTokens += outputTokens;
            metrics.cacheReadTokens += cachedTokens;
            const model = findAttribute(attrs, 'model');
            if (model) metrics.model = String(model);

            // Estimate cost from OpenAI API pricing (Codex doesn't report cost_usd)
            // Non-cached input tokens = total input - cached
            metrics.costUsd += estimateOpenAICost(String(model ?? 'gpt-5-codex'), inputTokens - cachedTokens, outputTokens, cachedTokens);
          }

          if (isToolEvent) {
            const toolName = findAttribute(attrs, 'tool_name');
            if (toolName) metrics.toolsUsed.add(String(toolName));
          }
        }
      }
    }

    // Codex duration is computed after job lookup (needs job.startedAt)

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
        startedAt: true,
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

    // For Codex: estimate duration as max(event timestamp) - job.startedAt
    // Each batch only covers seconds; we need total time since job started
    if (maxCodexTimestampNs > -Infinity && job.startedAt) {
      const maxEventMs = Math.round(maxCodexTimestampNs / 1_000_000);
      const jobStartMs = job.startedAt.getTime();
      const codexDurationMs = maxEventMs - jobStartMs;
      if (codexDurationMs > 0) {
        // Use max() — later batches always have higher timestamps, so duration grows monotonically
        metrics.durationMs = Math.max(metrics.durationMs, codexDurationMs);
      }
    }

    // Aggregate with existing metrics (OTLP may send multiple batches)
    const updateData: Parameters<typeof prisma.job.update>[0]['data'] = {
      inputTokens: (job.inputTokens || 0) + metrics.inputTokens,
      outputTokens: (job.outputTokens || 0) + metrics.outputTokens,
      cacheReadTokens: (job.cacheReadTokens || 0) + metrics.cacheReadTokens,
      cacheCreationTokens: (job.cacheCreationTokens || 0) + metrics.cacheCreationTokens,
      costUsd: (job.costUsd || 0) + metrics.costUsd,
      // For Codex duration: use max (monotonically increasing); for Claude: accumulate per-request durations
      durationMs: maxCodexTimestampNs > -Infinity
        ? Math.max(job.durationMs || 0, metrics.durationMs)
        : (job.durationMs || 0) + metrics.durationMs,
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

/**
 * Estimate OpenAI API cost from token counts.
 * Used for Codex telemetry which doesn't include cost_usd.
 * Prices are per-million tokens (source: openai.com/api/pricing).
 */
const OPENAI_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'gpt-5-codex':   { input: 1.25, output: 10.00, cached: 0.625 },
  'gpt-5.3-codex': { input: 1.75, output: 14.00, cached: 0.875 },
  'gpt-5':         { input: 2.00, output: 8.00,  cached: 1.00 },
  'o3':            { input: 2.00, output: 8.00,  cached: 1.00 },
  'o4-mini':       { input: 0.40, output: 1.60,  cached: 0.20 },
};

function estimateOpenAICost(model: string, inputTokens: number, outputTokens: number, cachedTokens: number): number {
  const pricing = OPENAI_PRICING[model] ?? OPENAI_PRICING['gpt-5-codex']!;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cachedTokens / 1_000_000) * pricing.cached
  );
}

/**
 * Normalize OTLP protobuf JSON snake_case keys to camelCase.
 * The Rust OTLP exporter uses snake_case (resource_logs, scope_logs, log_records, etc.)
 * while the JS OTLP exporter uses camelCase (resourceLogs, scopeLogs, logRecords, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOtlpKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(normalizeOtlpKeys);
  }
  if (obj && typeof obj === 'object') {
    const snakeToCamelMap: Record<string, string> = {
      resource_logs: 'resourceLogs',
      scope_logs: 'scopeLogs',
      log_records: 'logRecords',
      time_unix_nano: 'timeUnixNano',
      observed_time_unix_nano: 'observedTimeUnixNano',
      severity_number: 'severityNumber',
      severity_text: 'severityText',
      string_value: 'stringValue',
      int_value: 'intValue',
      double_value: 'doubleValue',
      bool_value: 'boolValue',
      array_value: 'arrayValue',
      dropped_attributes_count: 'droppedAttributesCount',
      trace_id: 'traceId',
      span_id: 'spanId',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamelMap[key] || key;
      result[camelKey] = normalizeOtlpKeys(value);
    }
    return result;
  }
  return obj;
}
