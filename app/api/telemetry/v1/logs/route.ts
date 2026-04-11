import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import {
  otlpLogsSchema,
  findAttribute,
  parseIntAttribute,
  parseFloatAttribute,
} from '@/lib/schemas/otlp';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';

const batchPayloadSchema = z.object({
  jobId: z.number().int().positive().optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheCreationTokens: z.number().int().nonnegative().optional(),
  model: z.string().optional(),
  toolsUsed: z.array(z.string()).optional(),
});

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
      // If JSON parse fails, try reading as text for debugging
      console.error('[OTLP Telemetry] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Ignore metrics that arrive at the logs endpoint
    if (body && (body.resourceMetrics || body.resource_metrics)) {
      return NextResponse.json({ status: 'accepted', message: 'Metrics ignored at logs endpoint' }, { status: 200 });
    }

    // Process batch payload (Mistral post-execution telemetry)
    // Detected by absence of OTLP-specific keys — must check AFTER resourceLogs and resourceMetrics
    if (body && typeof body === 'object' && !body.resourceLogs && !body.resource_logs && !body.resourceMetrics && !body.resource_metrics) {
      return processBatchPayload(body, startTime);
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
    const metrics = createEmptyMetrics();

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

          // Gemini: token data in gemini_cli.api_response
          const isGeminiApiResponse = eventName === 'gemini_cli.api_response';
          // Gemini: tool usage in gemini_cli.tool_call
          const isGeminiToolCall = eventName === 'gemini_cli.tool_call';

          const isToolEvent = ['claude_code.tool_result', 'claude_code.tool_decision', 'codex.tool_result', 'codex.tool_decision'].includes(eventName);

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
            // Codex input_token_count is the TOTAL input (includes cached),
            // unlike Claude where input_tokens is only non-cached.
            // Normalize: store only non-cached in inputTokens for consistency.
            const totalInputTokens = parseIntAttribute(findAttribute(attrs, 'input_token_count'));
            const outputTokens = parseIntAttribute(findAttribute(attrs, 'output_token_count'));
            const cachedTokens = parseIntAttribute(findAttribute(attrs, 'cached_token_count'));
            const nonCachedInputTokens = totalInputTokens - cachedTokens;
            metrics.inputTokens += nonCachedInputTokens;
            metrics.outputTokens += outputTokens;
            metrics.cacheReadTokens += cachedTokens;
            const model = findAttribute(attrs, 'model');
            if (model) metrics.model = String(model);

            // Estimate cost from OpenAI API pricing (Codex doesn't report cost_usd)
            metrics.costUsd += estimateOpenAICost(String(model ?? 'gpt-5.4'), nonCachedInputTokens, outputTokens, cachedTokens);
          }

          if (isGeminiApiResponse) {
            metrics.inputTokens += parseIntAttribute(findAttribute(attrs, 'input_tokens'));
            metrics.outputTokens += parseIntAttribute(findAttribute(attrs, 'output_tokens'));
            // Gemini thought_tokens map to cacheReadTokens for consistency
            metrics.cacheReadTokens += parseIntAttribute(findAttribute(attrs, 'thought_tokens'));
            metrics.durationMs += parseIntAttribute(findAttribute(attrs, 'duration_ms'));
            const model = findAttribute(attrs, 'model');
            if (model) metrics.model = String(model);

            metrics.costUsd += estimateGeminiCost(
              String(model ?? 'gemini-2.5-pro'),
              parseIntAttribute(findAttribute(attrs, 'input_tokens')),
              parseIntAttribute(findAttribute(attrs, 'output_tokens')),
              parseIntAttribute(findAttribute(attrs, 'thought_tokens')),
            );
          }

          if (isGeminiToolCall) {
            const toolName = findAttribute(attrs, 'tool_name');
            if (toolName) metrics.toolsUsed.add(String(toolName));
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

    // Both Claude and Codex OTLP exporters send delta batches (each batch
    // contains only NEW log records since the last successful export).
    // All metrics are accumulated by summation.
    // Duration: Claude reports per-request duration_ms (accumulated here);
    // Codex doesn't — duration is backfilled from job wall clock on completion.
    return updateJobMetrics(jobId, metrics, startTime, 'Success');

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

interface TelemetryMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
  model: string | null;
  toolsUsed: Set<string>;
}

function createEmptyMetrics(): TelemetryMetrics {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    durationMs: 0,
    model: null,
    toolsUsed: new Set<string>(),
  };
}

/**
 * Look up the job, merge accumulated metrics, persist, and return the response.
 */
async function updateJobMetrics(
  jobId: number,
  metrics: TelemetryMetrics,
  startTime: number,
  logLabel: string
): Promise<NextResponse> {
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
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const mergedTools = [...new Set([...job.toolsUsed, ...metrics.toolsUsed])].sort();

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
  console.log(`[OTLP Telemetry] ${logLabel}:`, {
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
}

/**
 * Estimate OpenAI API cost from token counts.
 * Used for Codex telemetry which doesn't include cost_usd.
 * Prices are per-million tokens (source: openai.com/api/pricing).
 */
const OPENAI_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'gpt-5-codex':   { input: 1.25, output: 10.00, cached: 0.625 },
  'gpt-5.3-codex': { input: 1.75, output: 14.00, cached: 0.875 },
  'gpt-5.4':       { input: 2.50, output: 15.00, cached: 0.25 },
  'gpt-5':         { input: 2.00, output: 8.00,  cached: 1.00 },
};

function estimateOpenAICost(model: string, inputTokens: number, outputTokens: number, cachedTokens: number): number {
  const pricing = OPENAI_PRICING[model] ?? OPENAI_PRICING['gpt-5.4']!;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cachedTokens / 1_000_000) * pricing.cached
  );
}

/**
 * Estimate Mistral API cost from token counts.
 * Prices are per-million tokens (source: Mistral API pricing).
 */
const MISTRAL_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'mistral-large-latest':    { input: 2.00, output: 6.00, cached: 1.00 },
  'mistral-medium-latest':   { input: 0.70, output: 2.10, cached: 0.35 },
  'mistral-small-latest':    { input: 0.10, output: 0.30, cached: 0.05 },
  'codestral-latest':        { input: 0.30, output: 0.90, cached: 0.15 },
  'devstral-small-latest':   { input: 0.10, output: 0.30, cached: 0.05 },
  'devstral-medium-latest':  { input: 0.50, output: 1.50, cached: 0.25 },
};

function estimateMistralCost(model: string, inputTokens: number, outputTokens: number, cachedTokens: number): number {
  const pricing = MISTRAL_PRICING[model] ?? MISTRAL_PRICING['mistral-large-latest']!;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cachedTokens / 1_000_000) * pricing.cached
  );
}

/**
 * Estimate Google Gemini API cost from token counts.
 * Prices are per-million tokens (source: Google AI pricing).
 */
const GEMINI_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'gemini-2.5-pro':   { input: 1.25, output: 10.00, cached: 0.3125 },
  'gemini-2.5-flash': { input: 0.15, output: 3.50,  cached: 0.0375 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40,  cached: 0.025 },
};

function estimateGeminiCost(model: string, inputTokens: number, outputTokens: number, cachedTokens: number): number {
  const pricing = GEMINI_PRICING[model] ?? GEMINI_PRICING['gemini-2.5-pro']!;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cachedTokens / 1_000_000) * pricing.cached
  );
}

/**
 * Process batch telemetry payload (Mistral post-execution scrape).
 * Accepts a simple JSON object with pre-aggregated metrics.
 */
async function processBatchPayload(body: unknown, startTime: number): Promise<NextResponse> {
  const validationResult = batchPayloadSchema.safeParse(body);
  if (!validationResult.success) {
    console.error('[Batch Telemetry] Schema validation failed:', {
      errors: validationResult.error.issues,
    });
    return NextResponse.json({ error: 'Invalid batch payload' }, { status: 400 });
  }

  const data = validationResult.data;

  if (!data.jobId) {
    console.warn('[Batch Telemetry] No jobId in payload, metrics not stored');
    return NextResponse.json({
      status: 'accepted',
      message: 'Telemetry received but no jobId found',
    }, { status: 200 });
  }

  const metrics = createEmptyMetrics();
  metrics.inputTokens = data.inputTokens ?? 0;
  metrics.outputTokens = data.outputTokens ?? 0;
  metrics.cacheReadTokens = data.cacheReadTokens ?? 0;
  metrics.cacheCreationTokens = data.cacheCreationTokens ?? 0;
  metrics.model = data.model ?? null;

  for (const tool of data.toolsUsed ?? []) {
    metrics.toolsUsed.add(tool);
  }

  // Estimate cost if tokens provided
  if (metrics.inputTokens > 0 || metrics.outputTokens > 0) {
    metrics.costUsd = estimateMistralCost(
      data.model ?? 'mistral-large-latest',
      metrics.inputTokens,
      metrics.outputTokens,
      metrics.cacheReadTokens,
    );
  }

  return updateJobMetrics(data.jobId, metrics, startTime, 'Batch processed');
}

/**
 * Normalize OTLP protobuf JSON snake_case keys to camelCase.
 * The Rust OTLP exporter uses snake_case (resource_logs, scope_logs, log_records, etc.)
 * while the JS OTLP exporter uses camelCase (resourceLogs, scopeLogs, logRecords, etc.)
 */
function normalizeOtlpKeys(obj: unknown): unknown {
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
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamelMap[key] || key;
      result[camelKey] = normalizeOtlpKeys(value);
    }
    return result;
  }
  return obj;
}
