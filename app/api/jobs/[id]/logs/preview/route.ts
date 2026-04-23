import { NextRequest, NextResponse } from 'next/server';
import { getLogService } from '@/lib/services/log-service';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';

/**
 * GET /api/jobs/[id]/logs/preview
 * Get preview of job execution logs
 *
 * This endpoint returns a lightweight preview of logs for inline display
 * in the job timeline without requiring the full log content.
 *
 * Success Response (200):
 * {
 *   "previewContent": "...",
 *   "hasFullLogs": true,
 *   "errorCount": 2,
 *   "warningCount": 1
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
      console.error('[Log Preview] Authentication failed:', authResult.error);
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
      console.error('[Log Preview] Invalid job ID format:', jobIdString);
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Get log preview using log service
    const logService = getLogService();
    const preview = await logService.getLogPreview(jobId);

    if (!preview) {
      console.log('[Log Preview] Logs not found:', { jobId });
      return NextResponse.json(
        { error: 'Logs not found' },
        { status: 404 }
      );
    }

    const elapsedTime = Date.now() - startTime;
    console.log('[Log Preview] Success:', {
      jobId,
      previewLength: preview.previewContent.length,
      errorCount: preview.errorCount,
      warningCount: preview.warningCount,
      elapsedMs: elapsedTime,
    });

    return NextResponse.json(preview, { status: 200 });
  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;

    console.error('[Log Preview] Unexpected error:', {
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