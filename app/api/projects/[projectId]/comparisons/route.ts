/**
 * Project-wide Comparisons API Route
 *
 * GET /api/projects/:projectId/comparisons
 * Returns all comparison reports across all tickets in the project.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

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
 * Extract alignment score from report content
 */
function extractAlignmentScore(content: string): number {
  // Look for "Feature Alignment: XX%" pattern
  const match = content.match(/Feature Alignment[:\s]+(\d+)%/i);
  if (match) {
    return parseInt(match[1]!, 10);
  }

  // Fallback: look in table format
  const tableMatch = content.match(/\|\s*\*\*Overall\*\*\s*\|\s*\*\*(\d+)%\*\*/);
  if (tableMatch) {
    return parseInt(tableMatch[1]!, 10);
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
  } catch (error) {
    console.error('Error fetching project comparisons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
