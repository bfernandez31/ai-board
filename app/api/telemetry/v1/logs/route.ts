import { NextRequest, NextResponse } from 'next/server';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { processTelemetry } from '@/lib/telemetry/otlp-processor';

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

  // Validate workflow authentication
  const authResult = validateWorkflowAuth(request);
  if (!authResult.isValid) {
    console.error('[OTLP Telemetry] Authentication failed:', authResult.error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error('[OTLP Telemetry] JSON parse error:', parseError);
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  try {
    const result = await processTelemetry(body, startTime);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;

    console.error('[OTLP Telemetry] Unexpected error:', {
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
