/**
 * GET /api/projects/[projectId]/outcomes
 *
 * Lists ticket outcomes for a project, optionally filtered by frictionFree
 * status or domain. Authenticated, project-access required.
 *
 * Query parameters:
 *   - frictionFree: 'true' | 'false' — filter by friction status
 *   - domain: string — filter to outcomes whose structuralDomains contains the value
 *   - limit: number — page size (default 50, max 200)
 *   - offset: number — pagination offset
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId, request);

    const url = new URL(request.url);
    const frictionFreeParam = url.searchParams.get('frictionFree');
    const domain = url.searchParams.get('domain');
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
    const rawOffset = parseInt(url.searchParams.get('offset') ?? '', 10);

    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const where: Record<string, unknown> = { projectId };
    if (frictionFreeParam === 'true') where.frictionFree = true;
    if (frictionFreeParam === 'false') where.frictionFree = false;
    if (domain) where.structuralDomains = { has: domain };

    const [outcomes, total] = await Promise.all([
      prisma.ticketOutcome.findMany({
        where,
        orderBy: { computedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          ticket: {
            select: { id: true, ticketKey: true, title: true, branch: true },
          },
        },
      }),
      prisma.ticketOutcome.count({ where }),
    ]);

    return NextResponse.json({ outcomes, total, limit, offset });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('Error fetching outcomes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
