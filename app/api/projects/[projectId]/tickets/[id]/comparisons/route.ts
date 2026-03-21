import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { listTicketComparisons } from '@/lib/comparison/comparison-detail';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { resolveTicket } from '@/app/lib/utils/ticket-resolver';
import { getProjectById } from '@/lib/db/projects';
import { persistGeneratedComparisonArtifacts } from '@/lib/comparison/comparison-generator';
import { Agent, Stage, WorkflowType } from '@prisma/client';
import type { ComparisonReport, ImplementationMetrics } from '@/lib/types/comparison';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive(),
});

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
});

const workflowTicketSchema = z.object({
  id: z.number().int().positive(),
  ticketKey: z.string().min(1),
  title: z.string().min(1),
  stage: z.nativeEnum(Stage),
  workflowType: z.nativeEnum(WorkflowType),
  agent: z.nativeEnum(Agent).nullable(),
});

const comparisonPayloadSchema = z.object({
  sourceTicket: workflowTicketSchema,
  participants: z.array(workflowTicketSchema).min(1),
  branch: z.string().min(1),
  report: z.object({
    metadata: z.object({
      generatedAt: z.coerce.date(),
      sourceTicket: z.string().min(1),
      comparedTickets: z.array(z.string().min(1)).min(1),
      filePath: z.string().min(1),
    }),
    summary: z.string(),
    alignment: z.object({
      overall: z.number(),
      dimensions: z.object({
        requirements: z.number(),
        scenarios: z.number(),
        entities: z.number(),
        keywords: z.number(),
      }),
      isAligned: z.boolean(),
      matchingRequirements: z.array(z.string()),
      matchingEntities: z.array(z.string()),
    }),
    implementation: z.record(
      z.string(),
      z.object({
        ticketKey: z.string().min(1),
        linesAdded: z.number(),
        linesRemoved: z.number(),
        linesChanged: z.number(),
        filesChanged: z.number(),
        changedFiles: z.array(z.string()),
        testFilesChanged: z.number(),
        testCoverage: z.number().optional(),
        hasData: z.boolean(),
      })
    ),
    compliance: z.record(
      z.string(),
      z.object({
        overall: z.number(),
        totalPrinciples: z.number(),
        passedPrinciples: z.number(),
        principles: z.array(
          z.object({
            name: z.string().min(1),
            section: z.string().min(1),
            passed: z.boolean(),
            notes: z.string(),
          })
        ),
      })
    ),
    telemetry: z.record(
      z.string(),
      z.object({
        ticketKey: z.string().min(1),
        inputTokens: z.number(),
        outputTokens: z.number(),
        cacheReadTokens: z.number(),
        cacheCreationTokens: z.number(),
        costUsd: z.number(),
        durationMs: z.number(),
        model: z.string().nullable(),
        toolsUsed: z.array(z.string()),
        jobCount: z.number(),
        hasData: z.boolean(),
      })
    ),
    recommendation: z.string(),
    warnings: z.array(z.string()),
  }),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const paramsResult = paramsSchema.safeParse(await context.params);
    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project or ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { projectId, id: ticketId } = paramsResult.data;
    const queryResult = querySchema.safeParse({
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const ticket = await verifyTicketAccess(ticketId, request);
    if (ticket.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'WRONG_PROJECT' },
        { status: 403 }
      );
    }

    const result = await listTicketComparisons(ticketId, queryResult.data.limit);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Ticket not found') {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid workflow token' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const projectIdResult = ProjectIdSchema.safeParse(params.projectId);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(params.projectId, 10);
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const ticket = await resolveTicket(projectId, params.id);
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const payloadResult = comparisonPayloadSchema.safeParse(body);
    if (!payloadResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: payloadResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const payload = payloadResult.data;
    if (payload.sourceTicket.id !== ticket.id) {
      return NextResponse.json(
        {
          error: 'Source ticket does not match route ticket',
          code: 'SOURCE_TICKET_MISMATCH',
        },
        { status: 400 }
      );
    }

    if (payload.sourceTicket.ticketKey !== ticket.ticketKey) {
      return NextResponse.json(
        {
          error: 'Source ticket key does not match route ticket',
          code: 'SOURCE_TICKET_KEY_MISMATCH',
        },
        { status: 400 }
      );
    }

    const implementation: Record<string, ImplementationMetrics> = Object.fromEntries(
      Object.entries(payload.report.implementation).map(([ticketKey, metrics]) => {
        const normalizedMetrics: ImplementationMetrics =
          metrics.testCoverage === undefined
            ? {
                ticketKey: metrics.ticketKey,
                linesAdded: metrics.linesAdded,
                linesRemoved: metrics.linesRemoved,
                linesChanged: metrics.linesChanged,
                filesChanged: metrics.filesChanged,
                changedFiles: metrics.changedFiles,
                testFilesChanged: metrics.testFilesChanged,
                hasData: metrics.hasData,
              }
            : {
                ticketKey: metrics.ticketKey,
                linesAdded: metrics.linesAdded,
                linesRemoved: metrics.linesRemoved,
                linesChanged: metrics.linesChanged,
                filesChanged: metrics.filesChanged,
                changedFiles: metrics.changedFiles,
                testFilesChanged: metrics.testFilesChanged,
                testCoverage: metrics.testCoverage,
                hasData: metrics.hasData,
              };

        return [ticketKey, normalizedMetrics];
      })
    );

    const normalizedReport: ComparisonReport = {
      ...payload.report,
      implementation,
    };

    const result = await persistGeneratedComparisonArtifacts({
      projectId,
      sourceTicket: payload.sourceTicket,
      participants: payload.participants,
      branch: payload.branch,
      report: normalizedReport,
    });

    return NextResponse.json(
      {
        id: result.record.id,
        markdownPath: result.markdownPath,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error persisting generated comparison artifacts:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
