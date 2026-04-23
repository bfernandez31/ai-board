/**
 * POST /api/jobs/[id]/logs
 *
 * Ingestion endpoint for captured agent execution logs. Called by
 * GitHub Actions workflows once an agent finishes (COMPLETED / FAILED /
 * CANCELLED). Writes a normalized JobLog record plus a short summary
 * onto the Job row itself so the timeline can show an inline preview
 * without a second round-trip.
 *
 * Authentication: workflow Bearer token (same mechanism as job status
 * updates). Members of a project never POST logs; they only read them.
 *
 * Request body:
 *   { content: string, agent?: 'CLAUDE'|'CODEX'|'MISTRAL'|'GEMINI' }
 *
 * Response: { id, jobId, truncated, byteSize, eventCount }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { normalizeAgentLog, MAX_LOG_CONTENT_BYTES } from '@/lib/logs/normalize';

const RAW_INPUT_LIMIT = 4 * MAX_LOG_CONTENT_BYTES;

const jobLogSchema = z.object({
  content: z.string().max(RAW_INPUT_LIMIT, 'Log content exceeds maximum size'),
  agent: z.enum(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const jobId = parseInt(params.id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = jobLogSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.issues.map((i) => ({
            message: i.message,
            path: i.path,
          })),
        },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const normalized = normalizeAgentLog(validation.data.content, {
      agent: validation.data.agent ?? null,
    });

    // Upsert the JobLog row so repeated workflow retries are safe.
    const log = await prisma.jobLog.upsert({
      where: { jobId },
      create: {
        jobId,
        content: normalized.content,
        summary: normalized.summary || null,
        truncated: normalized.truncated,
        byteSize: normalized.byteSize,
        eventCount: normalized.eventCount,
        agent: normalized.agent,
      },
      update: {
        content: normalized.content,
        summary: normalized.summary || null,
        truncated: normalized.truncated,
        byteSize: normalized.byteSize,
        eventCount: normalized.eventCount,
        agent: normalized.agent,
      },
    });

    // Mirror the summary on the Job.logs column so listing endpoints can
    // surface it without joining the JobLog table.
    await prisma.job.update({
      where: { id: jobId },
      data: { logs: normalized.summary || null },
    });

    return NextResponse.json(
      {
        id: log.id,
        jobId: log.jobId,
        truncated: log.truncated,
        byteSize: log.byteSize,
        eventCount: log.eventCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Job Logs Ingest] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
