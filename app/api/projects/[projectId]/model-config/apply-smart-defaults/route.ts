import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { SMART_DEFAULTS } from '@/lib/models/claude-models';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const parsedProjectId = parseInt(projectId, 10);

    if (isNaN(parsedProjectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(parsedProjectId, request);

    const updated = await prisma.project.update({
      where: { id: parsedProjectId },
      data: { ...SMART_DEFAULTS },
      select: {
        specifyModel: true,
        planModel: true,
        implementModel: true,
        quickImplModel: true,
        verifyModel: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (
      error instanceof Error &&
      (error.message === 'Authentication required' || error.message === 'Unauthorized')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('apply-smart-defaults POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
