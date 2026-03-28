import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { getActiveScan, getScanHistory } from '@/lib/health/queries';
import { dispatchHealthScanWorkflow } from '@/app/lib/workflows/dispatch-health-scan';
import type { HealthScanType } from '@prisma/client';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

const postBodySchema = z.object({
  scanType: z.enum(['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC']),
});

const querySchema = z.object({
  type: z.enum(['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

type RouteParams = { projectId: string };

function jsonError(status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const paramsResult = paramsSchema.safeParse(await context.params);
    if (!paramsResult.success) {
      return jsonError(400, 'Invalid project ID', 'VALIDATION_ERROR');
    }

    const { projectId } = paramsResult.data;
    await verifyProjectAccess(projectId, request);

    const queryResult = querySchema.safeParse({
      type: request.nextUrl.searchParams.get('type') ?? undefined,
      page: request.nextUrl.searchParams.get('page') ?? undefined,
      pageSize: request.nextUrl.searchParams.get('pageSize') ?? undefined,
    });

    if (!queryResult.success) {
      return jsonError(400, 'Invalid query parameters', 'VALIDATION_ERROR');
    }

    const result = await getScanHistory(projectId, {
      type: queryResult.data.type as HealthScanType | undefined,
      page: queryResult.data.page,
      pageSize: queryResult.data.pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return jsonError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonError(401, 'Unauthorized', 'AUTH_REQUIRED');
    }
    return jsonError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const paramsResult = paramsSchema.safeParse(await context.params);
    if (!paramsResult.success) {
      return jsonError(400, 'Invalid project ID', 'VALIDATION_ERROR');
    }

    const { projectId } = paramsResult.data;
    const project = await verifyProjectAccess(projectId, request);

    const body = await request.json();
    const bodyResult = postBodySchema.safeParse(body);
    if (!bodyResult.success) {
      return jsonError(400, 'Invalid request body', 'VALIDATION_ERROR');
    }

    const { scanType } = bodyResult.data;

    // Check for concurrent scan of same type
    const activeScan = await getActiveScan(projectId, scanType);
    if (activeScan) {
      return jsonError(
        409,
        `A ${scanType} scan is already in progress for this project`,
        'SCAN_IN_PROGRESS'
      );
    }

    // Derive base commit from last completed scan of same type
    const lastCompletedScan = await prisma.healthScan.findFirst({
      where: {
        projectId,
        scanType,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      select: { headCommit: true },
    });

    const baseCommit = lastCompletedScan?.headCommit ?? null;

    // Create scan record
    const scan = await prisma.healthScan.create({
      data: {
        projectId,
        scanType,
        baseCommit,
      },
    });

    // Dispatch workflow
    try {
      await dispatchHealthScanWorkflow({
        project_id: String(projectId),
        scan_type: scanType,
        scan_id: String(scan.id),
        base_commit: baseCommit ?? '',
        head_commit: '',
        githubRepository: `${project.githubOwner}/${project.githubRepo}`,
      });
    } catch (dispatchError) {
      // Mark scan as failed if dispatch fails
      await prisma.healthScan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          errorMessage: dispatchError instanceof Error ? dispatchError.message : 'Workflow dispatch failed',
        },
      });

      const failedScan = await prisma.healthScan.findUnique({ where: { id: scan.id } });
      return NextResponse.json({ scan: failedScan }, { status: 201 });
    }

    return NextResponse.json({ scan }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return jsonError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonError(401, 'Unauthorized', 'AUTH_REQUIRED');
    }
    return jsonError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}
