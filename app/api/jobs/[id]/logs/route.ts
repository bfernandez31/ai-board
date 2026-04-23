import { NextRequest, NextResponse } from 'next/server';
import { getLogService } from '@/lib/services/log-service';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { z } from 'zod';

/**
 * Log Capture Request Schema
 */
const logCaptureSchema = z.object({
  agentType: z.enum(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']),
  logContent: z.string().min(1, 'Log content cannot be empty'),
  logFormat: z.enum(['text', 'json']).default('text'),
});

export type LogCaptureRequest = z.infer<typeof logCaptureSchema>;

/**
 * POST /api/jobs/[id]/logs
 * Capture agent execution logs for a job
 *
 * This endpoint is called by GitHub Actions workflows to capture and store
 * agent execution logs when a job completes.
 *
 * Request Body:
 * {
 *   "agentType": "CLAUDE" | "CODEX" | "MISTRAL" | "GEMINI",
 *   "logContent": "string", // Raw log content from agent
 *   "logFormat": "text" | "json" // Format of logContent (default: "text")
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "jobLogId": 123,
 *   "previewContent": "...",
 *   "message": "Logs captured successfully"
 * }
 *
 * Error Responses:
 * - 400: Invalid request (validation error)
 * - 401: Unauthorized (invalid workflow authentication)
 * - 404: Job not found
 * - 500: Internal server error
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const startTime = Date.now();
  let jobId: number | undefined;

  try {
    // Validate workflow authentication
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      console.error('[Log Capture] Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract and validate job ID from URL
    const params = await context.params;
    const { id: jobIdString } = params;

    jobId = parseInt(jobIdString, 10);
    if (isNaN(jobId)) {
      console.error('[Log Capture] Invalid job ID format:', jobIdString);
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[Log Capture] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = logCaptureSchema.safeParse(body);
    if (!validationResult.success) {
      const zodErrors = validationResult.error.issues;
      console.error('[Log Capture] Validation failed:', {
        jobId,
        body,
        errors: zodErrors,
      });

      return NextResponse.json(
        {
          error: 'Invalid request',
          details: zodErrors.map((err) => ({
            message: err.message,
            path: err.path,
          })),
        },
        { status: 400 }
      );
    }

    const { agentType, logContent, logFormat } = validationResult.data;

    // Capture logs using log service
    const logService = getLogService();
    const result = await logService.captureLogs({
      jobId,
      agentType,
      logContent,
      logFormat,
    });

    if (!result.success) {
      console.error('[Log Capture] Failed to capture logs:', {
        jobId,
        error: result.error,
      });
      return NextResponse.json(
        {
          error: result.error || 'Failed to capture logs',
        },
        { status: 500 }
      );
    }

    const elapsedTime = Date.now() - startTime;
    console.log('[Log Capture] Success:', {
      jobId,
      jobLogId: result.jobLogId,
      contentSize: result.previewContent.length,
      elapsedMs: elapsedTime,
    });

    return NextResponse.json(
      {
        success: true,
        jobLogId: result.jobLogId,
        previewContent: result.previewContent,
        message: 'Logs captured successfully',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;

    console.error('[Log Capture] Unexpected error:', {
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
 * GET /api/jobs/[id]/logs
 * Retrieve agent execution logs for a job
 *
 * This endpoint retrieves captured logs for a specific job.
 *
 * Success Response (200):
 * {
 *   "jobId": 123,
 *   "agentType": "CLAUDE",
 *   "status": "COMPLETED",
 *   "timestamp": "2025-10-10T14:32:15.123Z",
 *   "preview": "...",
 *   "fullLogUrl": "https://...",
 *   "logEntries": [...],
 *   "contentSize": 12345,
 *   "expirationDate": "2025-11-10T14:32:15.123Z"
 * }
 *
 * Error Responses:
 * - 401: Unauthorized (invalid workflow authentication)
 * - 404: Logs not found
 * - 500: Internal server error
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const startTime = Date.now();
  let jobId: number | undefined;

  try {
    // Validate workflow authentication
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      console.error('[Log Retrieval] Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract and validate job ID from URL
    const params = await context.params;
    const { id: jobIdString } = params;

    jobId = parseInt(jobIdString, 10);
    if (isNaN(jobId)) {
      console.error('[Log Retrieval] Invalid job ID format:', jobIdString);
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Retrieve logs using log service
    const logService = getLogService();
    const logs = await logService.getJobLogs(jobId);

    if (!logs) {
      console.log('[Log Retrieval] Logs not found:', { jobId });
      return NextResponse.json(
        { error: 'Logs not found' },
        { status: 404 }
      );
    }

    const elapsedTime = Date.now() - startTime;
    console.log('[Log Retrieval] Success:', {
      jobId,
      contentSize: logs.contentSize,
      elapsedMs: elapsedTime,
    });

    return NextResponse.json(logs, { status: 200 });
  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;

    console.error('[Log Retrieval] Unexpected error:', {
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