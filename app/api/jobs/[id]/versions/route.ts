import { NextRequest, NextResponse } from 'next/server';
import { jobVersionsUpdateSchema } from '@/app/lib/job-versions-validator';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  let jobId: number | undefined;

  try {
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      console.error('[Job Versions] Authentication failed:', authResult.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    jobId = parseInt(params.id, 10);
    if (isNaN(jobId)) {
      console.error('[Job Versions] Invalid job ID format:', params.id);
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[Job Versions] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = jobVersionsUpdateSchema.safeParse(body);
    if (!validation.success) {
      console.error('[Job Versions] Validation failed:', {
        jobId,
        errors: validation.error.issues,
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues.map((err) => ({
            message: err.message,
            path: err.path,
          })),
        },
        { status: 400 }
      );
    }

    const exists = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!exists) {
      console.error('[Job Versions] Job not found:', { jobId });
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // First-write-wins via conditional updateMany so concurrent POSTs cannot
    // overwrite an already-set column. Each field is guarded independently.
    if (validation.data.pluginVersion) {
      await prisma.job.updateMany({
        where: { id: jobId, pluginVersion: null },
        data: { pluginVersion: validation.data.pluginVersion },
      });
    }
    if (validation.data.agentCliVersion) {
      await prisma.job.updateMany({
        where: { id: jobId, agentCliVersion: null },
        data: { agentCliVersion: validation.data.agentCliVersion },
      });
    }

    const stored = await prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      select: { id: true, pluginVersion: true, agentCliVersion: true },
    });

    const result = {
      id: stored.id,
      pluginVersion: stored.pluginVersion,
      agentCliVersion: stored.agentCliVersion,
    };

    console.log('[Job Versions] Success:', result);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('[Job Versions] Unexpected error:', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
