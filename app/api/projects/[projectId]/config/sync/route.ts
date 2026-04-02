import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { syncProjectConfig } from '@/lib/config-sync';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Verify project access (owner OR member)
    await verifyProjectAccess(projectId, request);

    // Fetch project with fields needed for config sync
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, githubOwner: true, githubRepo: true, configSyncedAt: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const result = await syncProjectConfig(project);

    if (!result.success) {
      switch (result.code) {
        case 'VALIDATION_ERROR':
          return NextResponse.json(
            { error: result.error, code: result.code, details: result.details },
            { status: 400 }
          );
        case 'CONFIG_NOT_FOUND':
          return NextResponse.json(
            { error: result.error, code: result.code },
            { status: 404 }
          );
        case 'YAML_PARSE_ERROR':
          return NextResponse.json(
            { error: result.error, code: result.code },
            { status: 400 }
          );
        case 'GITHUB_ERROR':
          return NextResponse.json(
            { error: result.error, code: result.code },
            { status: 502 }
          );
      }
    }

    return NextResponse.json({
      config: result.config,
      syncedAt: result.syncedAt,
      warnings: result.warnings,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    console.error('[config-sync] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
