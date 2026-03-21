/**
 * Project-wide Comparisons API Route
 *
 * GET /api/projects/:projectId/comparisons
 * Returns all comparison reports across all tickets in the project.
 *
 * POST /api/projects/:projectId/comparisons
 * Persists comparison data from workflow to database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { persistComparisonRecord } from '@/lib/comparison/comparison-record';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

interface FileComparisonEntry {
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
 * Extract best implementation score from report content.
 * Tries multiple known formats in priority order.
 */
const SCORE_PATTERNS = [
  /🏆.*?\((?:score:\s*)?(\d+)%\)/i,         // "🏆 Best: **AIB-125** (92%)"
  /\|\s*1\s*\|[^|]+\|\s*(\d+)%/,             // "| 1 | AIB-125 | 92% |"
  /Feature Alignment[:\s]+(\d+)%/i,           // "Feature Alignment: 92%"
  /Best Implementation[:\s]+[^(]+\((\d+)%\)/i // "Best Implementation: TICKET (92%)"
] as const;

function extractAlignmentScore(content: string): number {
  for (const pattern of SCORE_PATTERNS) {
    const match = content.match(pattern);
    if (match) return parseInt(match[1]!, 10);
  }
  return 0;
}

/**
 * GET - List all comparisons for a project
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum) || projectIdNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    try {
      await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tickets with branches
    const tickets = await prisma.ticket.findMany({
      where: {
        projectId: projectIdNum,
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

    const allComparisons: FileComparisonEntry[] = [];

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
  } catch (error) {
    console.error('Error fetching project comparisons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Zod schema for POST /api/projects/:projectId/comparisons
 * Validates PersistComparisonInput shape from workflow JSON payload.
 */
const persistableTicketSchema = z.object({
  id: z.number().int().positive(),
  ticketKey: z.string().min(1),
  title: z.string().min(1),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP', 'CLOSED']),
  workflowType: z.enum(['FULL', 'QUICK', 'CLEAN']),
  agent: z.enum(['CLAUDE', 'CODEX']).nullable(),
});

const persistComparisonSchema = z.object({
  projectId: z.number().int().positive(),
  sourceTicket: persistableTicketSchema,
  participants: z.array(persistableTicketSchema).min(1),
  markdownPath: z.string().min(1),
  report: z.object({
    metadata: z.object({
      generatedAt: z.string().or(z.date()),
      sourceTicket: z.string(),
      comparedTickets: z.array(z.string()).min(1),
      filePath: z.string(),
    }),
    summary: z.string(),
    alignment: z.looseObject({}),
    implementation: z.record(z.string(), z.looseObject({})),
    compliance: z.record(z.string(), z.looseObject({})),
    telemetry: z.record(z.string(), z.looseObject({})),
    recommendation: z.string(),
    warnings: z.array(z.string()),
  }),
});

/**
 * POST - Persist comparison data from workflow
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: authResult.error ?? 'Unauthorized' },
        { status: 401 }
      );
    }

    const { projectId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum) || projectIdNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parseResult = persistComparisonSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    if (data.projectId !== projectIdNum) {
      return NextResponse.json(
        { error: 'Project ID in body does not match URL parameter' },
        { status: 400 }
      );
    }

    const record = await persistComparisonRecord({
      projectId: data.projectId,
      sourceTicket: data.sourceTicket,
      participants: data.participants,
      markdownPath: data.markdownPath,
      report: data.report as unknown as Parameters<typeof persistComparisonRecord>[0]['report'],
    });

    return NextResponse.json(
      { id: record.id, generatedAt: record.generatedAt },
      { status: 201 }
    );
  } catch (error) {
    // Handle Prisma foreign key constraint violations
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2025')
    ) {
      return NextResponse.json(
        { error: 'Referenced entity not found (invalid ticket or project ID)' },
        { status: 400 }
      );
    }

    console.error('Error persisting comparison:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
