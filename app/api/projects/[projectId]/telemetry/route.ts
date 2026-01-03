import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { ProjectIdSchema } from '@/lib/validations/ticket';

/**
 * GET /api/projects/[projectId]/telemetry?ticketKeys=ABC-123,ABC-124
 * Get aggregated telemetry metrics for multiple tickets
 *
 * Query Parameters:
 * - ticketKeys: Comma-separated list of ticket keys (e.g., "ABC-123,ABC-124")
 *
 * Returns: JSON object mapping ticket keys to their telemetry metrics
 * Example: { "ABC-123": { inputTokens: 45000, outputTokens: 12000, ... }, ... }
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate projectId format
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Verify project access (owner OR member)
    await verifyProjectAccess(projectId);

    // Parse ticketKeys query parameter
    const { searchParams } = new URL(request.url);
    const ticketKeysParam = searchParams.get('ticketKeys');

    if (!ticketKeysParam) {
      return NextResponse.json(
        { error: 'ticketKeys query parameter is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const ticketKeys = ticketKeysParam.split(',').map((key) => key.trim());

    if (ticketKeys.length === 0) {
      return NextResponse.json(
        { error: 'At least one ticket key is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (ticketKeys.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 ticket keys allowed per request', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Fetch tickets with their jobs
    const tickets = await prisma.ticket.findMany({
      where: {
        projectId,
        ticketKey: {
          in: ticketKeys,
        },
      },
      select: {
        ticketKey: true,
        jobs: {
          select: {
            inputTokens: true,
            outputTokens: true,
            cacheReadTokens: true,
            cacheCreationTokens: true,
            costUsd: true,
            durationMs: true,
            model: true,
            toolsUsed: true,
            status: true,
            command: true,
          },
          orderBy: {
            startedAt: 'desc',
          },
        },
      },
    });

    // Aggregate telemetry for each ticket
    const telemetryMap: Record<
      string,
      {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
        costUsd: number;
        durationMs: number;
        models: string[];
        toolsUsed: string[];
        jobCount: number;
      }
    > = {};

    tickets.forEach((ticket) => {
      const metrics = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0,
        durationMs: 0,
        models: new Set<string>(),
        toolsUsed: new Set<string>(),
        jobCount: 0,
      };

      // Sum up metrics from all completed jobs
      ticket.jobs.forEach((job) => {
        if (job.status === 'COMPLETED') {
          metrics.inputTokens += job.inputTokens ?? 0;
          metrics.outputTokens += job.outputTokens ?? 0;
          metrics.cacheReadTokens += job.cacheReadTokens ?? 0;
          metrics.cacheCreationTokens += job.cacheCreationTokens ?? 0;
          metrics.costUsd += job.costUsd ?? 0;
          metrics.durationMs += job.durationMs ?? 0;
          metrics.jobCount += 1;

          if (job.model) {
            metrics.models.add(job.model);
          }

          job.toolsUsed.forEach((tool) => {
            metrics.toolsUsed.add(tool);
          });
        }
      });

      telemetryMap[ticket.ticketKey] = {
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        cacheReadTokens: metrics.cacheReadTokens,
        cacheCreationTokens: metrics.cacheCreationTokens,
        costUsd: metrics.costUsd,
        durationMs: metrics.durationMs,
        models: Array.from(metrics.models),
        toolsUsed: Array.from(metrics.toolsUsed),
        jobCount: metrics.jobCount,
      };
    });

    // Fill in empty metrics for tickets that weren't found
    ticketKeys.forEach((key) => {
      if (!telemetryMap[key]) {
        telemetryMap[key] = {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0,
          durationMs: 0,
          models: [],
          toolsUsed: [],
          jobCount: 0,
        };
      }
    });

    return NextResponse.json(telemetryMap);
  } catch (error) {
    console.error('Error fetching telemetry:', error);

    if (error instanceof Error) {
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: error.message, code: 'NOT_FOUND' }, { status: 404 });
      }

      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: error.message, code: 'UNAUTHORIZED' }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch telemetry', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
