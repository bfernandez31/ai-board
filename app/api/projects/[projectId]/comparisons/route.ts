/**
 * Project-wide Comparisons API Route
 *
 * GET /api/projects/:projectId/comparisons — List comparisons (file-based or DB-backed via ?source=db)
 * POST /api/projects/:projectId/comparisons — Save a new comparison (Bearer workflow token auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { createComparisonSchema } from '@/lib/schemas/comparison';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

interface ComparisonSummary {
  filename: string;
  generatedAt: string;
  sourceTicket: string;
  comparedTickets: string[];
  alignmentScore: number;
  isAligned: boolean;
  ticketId: number;
  ticketTitle: string;
}

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const dbQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Parse comparison filename to extract metadata
 * Format: YYYYMMDD-HHMMSS-vs-KEY1-KEY2.md
 */
function parseFilename(
  filename: string
): { timestamp: string; comparedTickets: string[] } | null {
  const match = filename.match(/^(\d{8}-\d{6})-vs-(.+)\.md$/);
  if (!match) return null;

  const timestamp = match[1]!;
  const keysStr = match[2]!;

  // Extract ticket keys (format: ABC-123)
  const keyPattern = /[A-Z0-9]{3,6}-\d+/g;
  const comparedTickets = keysStr.match(keyPattern) || [];

  return { timestamp, comparedTickets };
}

/**
 * Convert timestamp string to ISO date
 */
function timestampToDate(timestamp: string): string {
  // YYYYMMDD-HHMMSS -> YYYY-MM-DDTHH:MM:SS
  const dateStr = timestamp.replace(
    /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/,
    '$1-$2-$3T$4:$5:$6'
  );
  return new Date(dateStr).toISOString();
}

/**
 * Extract best implementation score from report content
 * Looks for the winner's score in various formats
 */
function extractAlignmentScore(content: string): number {
  // New format: "### 🏆 Best: **AIB-125** (92%)" or "🏆 1. **AIB-125** - Best overall (score: 92%)"
  const bestMatch = content.match(/🏆.*?\((?:score:\s*)?(\d+)%\)/i);
  if (bestMatch) {
    return parseInt(bestMatch[1]!, 10);
  }

  // Ranking table format: "| 1 | AIB-125 | 92% |"
  const rankingMatch = content.match(/\|\s*1\s*\|[^|]+\|\s*(\d+)%/);
  if (rankingMatch) {
    return parseInt(rankingMatch[1]!, 10);
  }

  // Legacy format: "Feature Alignment: XX%"
  const legacyMatch = content.match(/Feature Alignment[:\s]+(\d+)%/i);
  if (legacyMatch) {
    return parseInt(legacyMatch[1]!, 10);
  }

  // Fallback: look for any "Best Implementation: TICKET (XX%)" pattern
  const implMatch = content.match(/Best Implementation[:\s]+[^(]+\((\d+)%\)/i);
  if (implMatch) {
    return parseInt(implMatch[1]!, 10);
  }

  return 0;
}

/**
 * GET - List comparisons for a project
 * ?source=db returns DB-backed comparisons; default returns file-based
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Verify project access (throws on unauthorized)
    try {
      await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const source = request.nextUrl.searchParams.get('source');

    if (source === 'db') {
      return getDbComparisons(request, projectIdNum);
    }

    return getFileComparisons(request, projectIdNum);
  } catch (error) {
    console.error('Error fetching project comparisons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DB-backed comparison list
 */
async function getDbComparisons(
  request: NextRequest,
  projectId: number
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const parseResult = dbQuerySchema.safeParse({
    limit: searchParams.get('limit') ?? 20,
    offset: searchParams.get('offset') ?? 0,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters' },
      { status: 400 }
    );
  }

  const { limit, offset } = parseResult.data;

  const [comparisons, total] = await Promise.all([
    prisma.comparison.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        sourceTicket: { select: { ticketKey: true } },
        entries: {
          select: { ticketId: true, score: true, isWinner: true, rank: true },
          orderBy: { rank: 'asc' },
        },
      },
    }),
    prisma.comparison.count({ where: { projectId } }),
  ]);

  // Collect winner ticket IDs for batch lookup
  const winnerByComparison = new Map<number, { ticketId: number; score: number }>();
  for (const c of comparisons) {
    const winner = c.entries.find((e) => e.isWinner);
    if (winner) {
      winnerByComparison.set(c.id, { ticketId: winner.ticketId, score: winner.score });
    }
  }

  const winnerTicketIds = [...new Set(
    Array.from(winnerByComparison.values()).map((w) => w.ticketId)
  )];

  const winnerTickets = winnerTicketIds.length > 0
    ? await prisma.ticket.findMany({
        where: { id: { in: winnerTicketIds } },
        select: { id: true, ticketKey: true },
      })
    : [];

  const ticketKeyMap = new Map(winnerTickets.map((t) => [t.id, t.ticketKey]));

  const formatted = comparisons.map((c) => {
    const winner = winnerByComparison.get(c.id);
    return {
      id: c.id,
      sourceTicketId: c.sourceTicketId,
      sourceTicketKey: c.sourceTicket.ticketKey,
      recommendation: c.recommendation,
      createdAt: c.createdAt.toISOString(),
      entryCount: c.entries.length,
      winnerTicketKey: winner ? ticketKeyMap.get(winner.ticketId) ?? null : null,
      winnerScore: winner?.score ?? null,
    };
  });

  return NextResponse.json({
    comparisons: formatted,
    total,
    limit,
    offset,
  });
}

/**
 * File-based comparison list (legacy)
 */
async function getFileComparisons(
  request: NextRequest,
  projectId: number
): Promise<NextResponse> {
  // Get tickets with branches
  const tickets = await prisma.ticket.findMany({
    where: {
      projectId,
      branch: { not: null },
    },
    select: {
      id: true,
      ticketKey: true,
      title: true,
      branch: true,
    },
  });

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const parseResult = querySchema.safeParse({
    limit: searchParams.get('limit') ?? 20,
    offset: searchParams.get('offset') ?? 0,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters' },
      { status: 400 }
    );
  }

  const { limit, offset } = parseResult.data;

  // Collect all comparisons from all ticket branches
  const allComparisons: ComparisonSummary[] = [];

  for (const ticket of tickets) {
    if (!ticket.branch) continue;

    const comparisonsDir = path.join(
      process.cwd(),
      'specs',
      ticket.branch,
      'comparisons'
    );

    try {
      const files = await fs.readdir(comparisonsDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      for (const filename of mdFiles) {
        const parsed = parseFilename(filename);
        if (!parsed) continue;

        // Read file content for alignment score
        const filePath = path.join(comparisonsDir, filename);
        let content = '';
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch {
          continue;
        }

        const alignmentScore = extractAlignmentScore(content);

        allComparisons.push({
          filename,
          generatedAt: timestampToDate(parsed.timestamp),
          sourceTicket: ticket.ticketKey,
          comparedTickets: parsed.comparedTickets,
          alignmentScore,
          isAligned: alignmentScore >= 30,
          ticketId: ticket.id,
          ticketTitle: ticket.title,
        });
      }
    } catch {
      // Directory doesn't exist, skip
      continue;
    }
  }

  // Sort by generation date (newest first)
  allComparisons.sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );

  // Apply pagination
  const total = allComparisons.length;
  const paginatedComparisons = allComparisons.slice(offset, offset + limit);

  return NextResponse.json({
    comparisons: paginatedComparisons,
    total,
    limit,
    offset,
  });
}

/**
 * POST - Save a new comparison (Bearer workflow token auth)
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Bearer token authentication (workflow token)
    const authHeader = request.headers.get('authorization');
    const workflowToken = process.env.WORKFLOW_API_TOKEN;

    if (!workflowToken || !authHeader || authHeader !== `Bearer ${workflowToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid workflow token' },
        { status: 401 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectIdNum },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parseResult = createComparisonSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Business rule: source ticket must exist in this project
    const sourceTicket = await prisma.ticket.findFirst({
      where: { id: data.sourceTicketId, projectId: projectIdNum },
      select: { id: true },
    });

    if (!sourceTicket) {
      return NextResponse.json(
        { error: 'Source ticket not found in this project' },
        { status: 422 }
      );
    }

    const entryTicketIds = data.entries.map((e) => e.ticketId);

    // Business rule: no duplicate ticket IDs in entries
    const uniqueTicketIds = new Set(entryTicketIds);
    if (uniqueTicketIds.size !== entryTicketIds.length) {
      return NextResponse.json(
        { error: 'Duplicate ticket IDs in entries' },
        { status: 422 }
      );
    }

    // Business rule: exactly one winner
    const winners = data.entries.filter((e) => e.isWinner);
    if (winners.length !== 1) {
      return NextResponse.json(
        { error: 'Exactly one entry must be marked as winner' },
        { status: 422 }
      );
    }

    // Business rule: all entry ticket IDs must exist in this project
    const entryTickets = await prisma.ticket.findMany({
      where: { id: { in: entryTicketIds }, projectId: projectIdNum },
      select: { id: true },
    });

    if (entryTickets.length !== entryTicketIds.length) {
      return NextResponse.json(
        { error: 'One or more entry tickets not found in this project' },
        { status: 422 }
      );
    }

    // Create comparison with nested entries and decision points in a transaction
    const comparison = await prisma.$transaction(async (tx) => {
      const comp = await tx.comparison.create({
        data: {
          projectId: projectIdNum,
          sourceTicketId: data.sourceTicketId,
          recommendation: data.recommendation,
          notes: data.notes ?? null,
          entries: {
            create: data.entries.map((entry) => ({
              ticketId: entry.ticketId,
              rank: entry.rank,
              score: entry.score,
              isWinner: entry.isWinner,
              keyDifferentiators: entry.keyDifferentiators,
              linesAdded: entry.linesAdded,
              linesRemoved: entry.linesRemoved,
              sourceFileCount: entry.sourceFileCount,
              testFileCount: entry.testFileCount,
              testRatio: entry.testRatio,
              complianceData: entry.complianceData,
            })),
          },
          decisionPoints: {
            create: data.decisionPoints.map((dp) => ({
              topic: dp.topic,
              verdict: dp.verdict,
              approaches: dp.approaches,
            })),
          },
        },
        include: {
          entries: {
            select: {
              id: true,
              ticketId: true,
              rank: true,
              score: true,
              isWinner: true,
            },
            orderBy: { rank: 'asc' },
          },
        },
      });

      return comp;
    });

    return NextResponse.json(
      {
        id: comparison.id,
        projectId: projectIdNum,
        sourceTicketId: comparison.sourceTicketId,
        recommendation: comparison.recommendation,
        notes: comparison.notes,
        createdAt: comparison.createdAt.toISOString(),
        entries: comparison.entries,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving comparison:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
