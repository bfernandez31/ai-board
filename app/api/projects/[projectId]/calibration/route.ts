import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getCalibrationDashboard } from '@/lib/calibration/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const data = await getCalibrationDashboard(projectId);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    console.error('[calibration-api]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
