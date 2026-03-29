import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; scanId: string }> }
) {
  try {
    const { projectId: projectIdStr, scanId: scanIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    const scanId = parseInt(scanIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    if (isNaN(scanId) || scanId <= 0) {
      return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId, request);

    const scan = await prisma.healthScan.findFirst({
      where: { id: scanId, projectId },
      select: {
        id: true,
        scanType: true,
        completedAt: true,
      },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    if (!scan.completedAt) {
      return NextResponse.json({ tickets: [] });
    }

    // Find the next scan of same type to bound the time window
    const nextScan = await prisma.healthScan.findFirst({
      where: {
        projectId,
        scanType: scan.scanType,
        createdAt: { gt: scan.completedAt },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    // Find CLEAN tickets created in the window between this scan and the next
    const tickets = await prisma.ticket.findMany({
      where: {
        projectId,
        workflowType: 'CLEAN',
        createdAt: {
          gte: scan.completedAt,
          ...(nextScan ? { lt: nextScan.createdAt } : {}),
        },
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        stage: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('[Health Scan Tickets] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
