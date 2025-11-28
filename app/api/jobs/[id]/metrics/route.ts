import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';

/**
 * Schema for Claude telemetry metrics
 */
const metricsSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheCreationTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  model: z.string().max(50).optional(),
  toolsUsed: z.array(z.string()).optional(),
});

/**
 * PATCH /api/jobs/[id]/metrics
 * Update Job with Claude telemetry metrics from workflow execution
 *
 * This endpoint is called by GitHub Actions workflows after Claude Code CLI
 * execution to store aggregated telemetry data (tokens, cost, tools used).
 *
 * Request Body:
 * {
 *   "inputTokens": 1234,
 *   "outputTokens": 567,
 *   "cacheReadTokens": 100,
 *   "cacheCreationTokens": 5000,
 *   "costUsd": 0.05,
 *   "durationMs": 3500,
 *   "model": "claude-opus-4-5-20251101",
 *   "toolsUsed": ["Edit", "Bash", "Read"]
 * }
 *
 * Success Response (200):
 * {
 *   "id": 123,
 *   "inputTokens": 1234,
 *   "outputTokens": 567,
 *   ...
 * }
 *
 * Error Responses:
 * - 400: Invalid request (validation error)
 * - 401: Unauthorized (missing/invalid workflow token)
 * - 404: Job not found
 * - 500: Internal server error
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const startTime = Date.now();
  let jobId: number | undefined;

  try {
    // Validate workflow authentication
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      console.error('[Job Metrics Update] Authentication failed:', authResult.error);
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
      console.error('[Job Metrics Update] Invalid job ID format:', jobIdString);
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body with Zod
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[Job Metrics Update] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = metricsSchema.safeParse(body);
    if (!validationResult.success) {
      const zodErrors = validationResult.error.issues;
      console.error('[Job Metrics Update] Validation failed:', {
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

    const metrics = validationResult.data;

    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!job) {
      console.error('[Job Metrics Update] Job not found:', { jobId });
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Build update data - only include fields that are provided
    const updateData: {
      inputTokens?: number;
      outputTokens?: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
      costUsd?: number;
      durationMs?: number;
      model?: string;
      toolsUsed?: string[];
    } = {};

    if (metrics.inputTokens !== undefined) {
      updateData.inputTokens = metrics.inputTokens;
    }
    if (metrics.outputTokens !== undefined) {
      updateData.outputTokens = metrics.outputTokens;
    }
    if (metrics.cacheReadTokens !== undefined) {
      updateData.cacheReadTokens = metrics.cacheReadTokens;
    }
    if (metrics.cacheCreationTokens !== undefined) {
      updateData.cacheCreationTokens = metrics.cacheCreationTokens;
    }
    if (metrics.costUsd !== undefined) {
      updateData.costUsd = metrics.costUsd;
    }
    if (metrics.durationMs !== undefined) {
      updateData.durationMs = metrics.durationMs;
    }
    if (metrics.model !== undefined) {
      updateData.model = metrics.model;
    }
    if (metrics.toolsUsed !== undefined) {
      updateData.toolsUsed = metrics.toolsUsed;
    }

    // Update job with metrics
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

    const elapsedTime = Date.now() - startTime;
    console.log('[Job Metrics Update] Success:', {
      jobId,
      inputTokens: updatedJob.inputTokens,
      outputTokens: updatedJob.outputTokens,
      costUsd: updatedJob.costUsd,
      toolsUsed: updatedJob.toolsUsed,
      elapsedMs: elapsedTime,
    });

    return NextResponse.json(updatedJob, { status: 200 });
  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;

    console.error('[Job Metrics Update] Unexpected error:', {
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
