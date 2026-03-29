import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';

const latestScanSchema = z.object({
  type: z.enum(['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC']),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId, request);

    const { searchParams } = new URL(request.url);
    const parsed = latestScanSchema.safeParse({
      type: searchParams.get('type') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid or missing type parameter', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { type } = parsed.data;

    const scan = await prisma.healthScan.findFirst({
      where: { projectId, scanType: type },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        scanType: true,
        status: true,
        score: true,
        report: true,
        issuesFound: true,
        issuesFixed: true,
        baseCommit: true,
        headCommit: true,
        durationMs: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ scan: scan ?? null });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('[Health Latest Scan] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
