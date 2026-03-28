import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { dispatchHealthScanWorkflow } from '@/lib/health/scan-dispatch';

const triggerScanSchema = z.object({
  scanType: z.enum(['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC']),
});

const scanHistorySchema = z.object({
  type: z.enum(['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await verifyProjectAccess(projectId, request);

    const body = await request.json();
    const parsed = triggerScanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid scan type', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { scanType } = parsed.data;

    // Check for existing PENDING/RUNNING scan of same type
    const existingScan = await prisma.healthScan.findFirst({
      where: {
        projectId,
        scanType,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (existingScan) {
      return NextResponse.json(
        { error: `A ${scanType} scan is already running`, code: 'SCAN_IN_PROGRESS' },
        { status: 409 }
      );
    }

    // Find latest COMPLETED scan of this type for incremental base commit
    const lastCompletedScan = await prisma.healthScan.findFirst({
      where: {
        projectId,
        scanType,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      select: { headCommit: true },
    });

    const baseCommit = lastCompletedScan?.headCommit ?? null;

    // Create scan record
    const scan = await prisma.healthScan.create({
      data: {
        projectId,
        scanType,
        status: 'PENDING',
        baseCommit,
      },
    });

    // Dispatch workflow (non-blocking in test mode)
    try {
      await dispatchHealthScanWorkflow({
        scan_id: String(scan.id),
        project_id: String(projectId),
        scan_type: scanType,
        base_commit: baseCommit ?? '',
        head_commit: '',
        githubRepository: `${project.githubOwner}/${project.githubRepo}`,
      });
    } catch (dispatchError) {
      // Mark scan as FAILED if dispatch fails
      await prisma.healthScan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          errorMessage: dispatchError instanceof Error ? dispatchError.message : 'Workflow dispatch failed',
        },
      });
      throw dispatchError;
    }

    return NextResponse.json({ scan }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('[Health Scan Trigger] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const parsed = scanHistorySchema.safeParse({
      type: searchParams.get('type') || undefined,
      limit: searchParams.get('limit') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid filters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { type, limit, cursor } = parsed.data;

    const where: Record<string, unknown> = { projectId };
    if (type) where.scanType = type;
    if (cursor) where.id = { lt: cursor };

    const scans = await prisma.healthScan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to check hasMore
      select: {
        id: true,
        scanType: true,
        status: true,
        score: true,
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

    const hasMore = scans.length > limit;
    const results = hasMore ? scans.slice(0, limit) : scans;
    const lastResult = results[results.length - 1];
    const nextCursor = hasMore && lastResult ? lastResult.id : null;

    return NextResponse.json({
      scans: results,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('[Health Scan History] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
