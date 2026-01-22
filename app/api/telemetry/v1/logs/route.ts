import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';

/**
 * OTLP Log Record schema (simplified for Claude Code telemetry)
 *
 * Per OTLP JSON spec (protobuf JSON mapping), 64-bit integers (int64) are encoded
 * as decimal strings for precision, but implementations must accept both numbers
 * and strings when decoding. Claude Code may send either format.
 *
 * @see https://opentelemetry.io/docs/specs/otlp/
 * @see https://protobuf.dev/programming-guides/json/
 */
const otlpAttributeSchema = z.object({
  key: z.string(),
  value: z.object({
    stringValue: z.string().optional(),
    // intValue is int64 in protobuf - accept both string (spec) and number (common)
    intValue: z.union([z.string(), z.number()]).optional(),
    doubleValue: z.number().optional(),
    // boolValue support for completeness
    boolValue: z.boolean().optional(),
    // arrayValue support for potential future use
    arrayValue: z.object({
      values: z.array(z.unknown()).optional(),
    }).optional(),
  }),
});

const otlpLogRecordSchema = z.object({
  // timeUnixNano is fixed64 in protobuf - accept both string and number
  timeUnixNano: z.union([z.string(), z.number()]).optional(),
  // observedTimeUnixNano may also be sent
  observedTimeUnixNano: z.union([z.string(), z.number()]).optional(),
  // severityNumber is enum, typically sent as number
  severityNumber: z.number().optional(),
  // severityText is string representation
  severityText: z.string().optional(),
  body: z.object({
    stringValue: z.string().optional(),
  }).optional(),
  attributes: z.array(otlpAttributeSchema).optional(),
  // droppedAttributesCount may be sent
  droppedAttributesCount: z.number().optional(),
  // flags for trace flags
  flags: z.number().optional(),
  // traceId and spanId for correlation
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

const otlpScopeLogsSchema = z.object({
  scope: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
  logRecords: z.array(otlpLogRecordSchema).optional(),
});

const otlpResourceLogsSchema = z.object({
  resource: z.object({
    attributes: z.array(otlpAttributeSchema).optional(),
  }).optional(),
  scopeLogs: z.array(otlpScopeLogsSchema).optional(),
});

const otlpLogsSchema = z.object({
  resourceLogs: z.array(otlpResourceLogsSchema),
});

type OTLPAttribute = z.infer<typeof otlpAttributeSchema>;

/**
 * Extract value from OTLP attribute
 */
function getAttributeValue(attr: OTLPAttribute): string | number | undefined {
  if (attr.value.stringValue !== undefined) return attr.value.stringValue;
  if (attr.value.intValue !== undefined) return attr.value.intValue;
  if (attr.value.doubleValue !== undefined) return attr.value.doubleValue;
  return undefined;
}

/**
 * Find attribute by key in array
 */
function findAttribute(attributes: OTLPAttribute[] | undefined, key: string): string | number | undefined {
  if (!attributes) return undefined;
  const attr = attributes.find(a => a.key === key);
  return attr ? getAttributeValue(attr) : undefined;
}

/**
 * POST /api/telemetry/v1/logs
 *
 * OTLP HTTP JSON endpoint for receiving Claude Code telemetry.
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

          if (eventName === 'claude_code.api_request') {
            // Aggregate API request metrics
            const inputTokens = findAttribute(attrs, 'input_tokens');
            const outputTokens = findAttribute(attrs, 'output_tokens');
            const cacheReadTokens = findAttribute(attrs, 'cache_read_tokens');
            const cacheCreationTokens = findAttribute(attrs, 'cache_creation_tokens');
            const costUsd = findAttribute(attrs, 'cost_usd');
            const durationMs = findAttribute(attrs, 'duration_ms');
            const model = findAttribute(attrs, 'model');

            if (inputTokens) metrics.inputTokens += parseInt(String(inputTokens), 10) || 0;
            if (outputTokens) metrics.outputTokens += parseInt(String(outputTokens), 10) || 0;
            if (cacheReadTokens) metrics.cacheReadTokens += parseInt(String(cacheReadTokens), 10) || 0;
            if (cacheCreationTokens) metrics.cacheCreationTokens += parseInt(String(cacheCreationTokens), 10) || 0;
            if (costUsd) metrics.costUsd += parseFloat(String(costUsd)) || 0;
            if (durationMs) metrics.durationMs += parseInt(String(durationMs), 10) || 0;
            if (model) metrics.model = String(model);
          }

          if (eventName === 'claude_code.tool_result' || eventName === 'claude_code.tool_decision') {
            // Collect tool names
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
      },
    });

    if (!job) {
      console.error('[OTLP Telemetry] Job not found:', { jobId });
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Aggregate with existing metrics (OTLP may send multiple batches)
    const updateData: Parameters<typeof prisma.job.update>[0]['data'] = {
      inputTokens: (job.inputTokens || 0) + metrics.inputTokens,
      outputTokens: (job.outputTokens || 0) + metrics.outputTokens,
      cacheReadTokens: (job.cacheReadTokens || 0) + metrics.cacheReadTokens,
      cacheCreationTokens: (job.cacheCreationTokens || 0) + metrics.cacheCreationTokens,
      costUsd: (job.costUsd || 0) + metrics.costUsd,
      durationMs: (job.durationMs || 0) + metrics.durationMs,
      // Merge tools - get existing and add new ones
      toolsUsed: {
        push: Array.from(metrics.toolsUsed),
      },
    };

    // Only update model if we have one
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
        cacheReadTokens: true,
        cacheCreationTokens: true,
        costUsd: true,
        durationMs: true,
        model: true,
        toolsUsed: true,
      },
    });

    // Deduplicate toolsUsed array
    const uniqueTools = [...new Set(updatedJob.toolsUsed)].sort();
    if (uniqueTools.length !== updatedJob.toolsUsed.length) {
      await prisma.job.update({
        where: { id: jobId },
        data: { toolsUsed: uniqueTools },
      });
    }

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
