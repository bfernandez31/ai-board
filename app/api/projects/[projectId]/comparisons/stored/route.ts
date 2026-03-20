/**
 * Stored Comparisons API Route
 *
 * POST /api/projects/:projectId/comparisons/stored - Save comparison data
 * GET /api/projects/:projectId/comparisons/stored - List stored comparisons
 *
 * POST is called by the /compare command (workflow token auth).
 * GET is called by the frontend (session auth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const compliancePrincipleSchema = z.object({
  name: z.string(),
  section: z.string(),
  passed: z.boolean(),
  notes: z.string(),
});

const decisionPointSchema = z.object({
  name: z.string(),
  approaches: z.record(z.string(), z.string()),
  verdict: z.string(),
  bestTicket: z.string(),
});

const entrySchema = z.object({
  ticketKey: z.string().max(20),
  rank: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
  keyDifferentiator: z.string().max(500),
  linesAdded: z.number().int().nonnegative().default(0),
  linesRemoved: z.number().int().nonnegative().default(0),
  sourceFiles: z.number().int().nonnegative().default(0),
  testFiles: z.number().int().nonnegative().default(0),
  complianceScore: z.number().int().min(0).max(100).optional(),
  compliancePrinciples: z.array(compliancePrincipleSchema).optional(),
  decisionPoints: z.array(decisionPointSchema).optional(),
});

const createComparisonSchema = z.object({
  sourceTicketKey: z.string().max(20),
  recommendation: z.string().max(2000),
  winnerTicketKey: z.string().max(20).optional(),
  entries: z.array(entrySchema).min(2).max(6),
});

const querySchema = z.object({
  ticketKey: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * POST - Save comparison data from /compare command
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Workflow token auth (same as job status update)
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = createComparisonSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { sourceTicketKey, recommendation, winnerTicketKey, entries } = parseResult.data;

    const comparison = await prisma.ticketComparison.create({
      data: {
        projectId: projectIdNum,
        sourceTicketKey,
        recommendation,
        winnerTicketKey: winnerTicketKey ?? null,
        entries: {
          create: entries.map((entry) => ({
            ticketKey: entry.ticketKey,
            rank: entry.rank,
            score: entry.score,
            keyDifferentiator: entry.keyDifferentiator,
            linesAdded: entry.linesAdded,
            linesRemoved: entry.linesRemoved,
            sourceFiles: entry.sourceFiles,
            testFiles: entry.testFiles,
            complianceScore: entry.complianceScore ?? null,
            compliancePrinciples: entry.compliancePrinciples
              ? JSON.stringify(entry.compliancePrinciples)
              : null,
            decisionPoints: entry.decisionPoints
              ? JSON.stringify(entry.decisionPoints)
              : null,
          })),
        },
      },
      include: { entries: true },
    });

    return NextResponse.json(comparison, { status: 201 });
  } catch (error) {
    console.error('Error saving comparison:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET - List stored comparisons for a project, optionally filtered by ticket key
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    try {
      await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const parseResult = querySchema.safeParse({
      ticketKey: searchParams.get('ticketKey') ?? undefined,
      limit: searchParams.get('limit') ?? 20,
      offset: searchParams.get('offset') ?? 0,
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { ticketKey, limit, offset } = parseResult.data;

    // Build where clause - filter by ticket appearing in entries OR as source
    const where = ticketKey
      ? {
          projectId: projectIdNum,
          OR: [
            { sourceTicketKey: ticketKey },
            { entries: { some: { ticketKey } } },
          ],
        }
      : { projectId: projectIdNum };

    const [comparisons, total] = await Promise.all([
      prisma.ticketComparison.findMany({
        where,
        include: { entries: { orderBy: { rank: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ticketComparison.count({ where }),
    ]);

    // Parse JSON string fields back to objects
    const parsed = comparisons.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      entries: c.entries.map((e) => ({
        ...e,
        compliancePrinciples: e.compliancePrinciples
          ? JSON.parse(e.compliancePrinciples)
          : null,
        decisionPoints: e.decisionPoints
          ? JSON.parse(e.decisionPoints)
          : null,
      })),
    }));

    return NextResponse.json({ comparisons: parsed, total });
  } catch (error) {
    console.error('Error listing stored comparisons:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
