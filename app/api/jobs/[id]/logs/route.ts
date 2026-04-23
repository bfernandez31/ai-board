import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { parseAgentOutput } from '@/lib/logs/log-parser';
import { generateLogSummary } from '@/lib/logs/log-summarizer';
import { truncateOutput } from '@/lib/logs/log-truncator';

const MAX_RAW_SIZE = 5_242_880; // 5MB

const logUploadSchema = z.object({
  agentType: z.enum(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']),
  rawOutput: z.string().max(MAX_RAW_SIZE),
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
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const validation = logUploadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues.map((e) => ({ message: e.message, path: e.path })) },
        { status: 400 }
      );
    }

    const { agentType, rawOutput } = validation.data;

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, status: true } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const existing = await prisma.jobLog.findUnique({ where: { jobId } });
    if (existing) {
      return NextResponse.json({
        jobId,
        entryCount: existing.entryCount,
        rawSize: existing.rawSize,
        truncated: existing.truncated,
        message: 'Log already exists',
      }, { status: 200 });
    }

    const entries = parseAgentOutput(rawOutput, agentType);
    const summary = generateLogSummary(entries, job.status);
    const rawSize = Buffer.byteLength(rawOutput, 'utf8');
    const { content: truncatedContent, truncated } = truncateOutput(rawOutput, MAX_RAW_SIZE);

    const jobLog = await prisma.$transaction(async (tx) => {
      const log = await tx.jobLog.create({
        data: {
          jobId,
          agentType,
          rawContent: truncatedContent,
          entries: JSON.stringify(entries),
          entryCount: entries.length,
          rawSize,
          truncated,
        },
      });

      await tx.job.update({
        where: { id: jobId },
        data: { logStatus: 'AVAILABLE', logSummary: summary },
      });

      return log;
    });

    return NextResponse.json({
      jobId,
      entryCount: jobLog.entryCount,
      rawSize: jobLog.rawSize,
      truncated: jobLog.truncated,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Job Logs Upload] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized: Please sign in' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const jobId = parseInt(params.id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, logStatus: true, projectId: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    try {
      await verifyProjectAccess(job.projectId, request);
    } catch {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this project' },
        { status: 403 }
      );
    }

    if (job.logStatus === 'NONE') {
      return NextResponse.json(
        { error: 'Logs not available', logStatus: 'NONE' },
        { status: 404 }
      );
    }

    if (job.logStatus === 'PRUNED') {
      return NextResponse.json(
        { error: 'Logs expired', logStatus: 'PRUNED', message: 'Log content was pruned after the 30-day retention period' },
        { status: 410 }
      );
    }

    const jobLog = await prisma.jobLog.findUnique({ where: { jobId } });
    if (!jobLog) {
      return NextResponse.json(
        { error: 'Logs not available', logStatus: 'NONE' },
        { status: 404 }
      );
    }

    let entries: unknown[];
    try {
      entries = JSON.parse(jobLog.entries);
    } catch {
      entries = [];
    }

    return NextResponse.json({
      jobId: jobLog.jobId,
      agentType: jobLog.agentType,
      entries,
      entryCount: jobLog.entryCount,
      rawSize: jobLog.rawSize,
      truncated: jobLog.truncated,
      createdAt: jobLog.createdAt.toISOString(),
    });
  } catch (error: unknown) {
    console.error('[Job Logs GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
