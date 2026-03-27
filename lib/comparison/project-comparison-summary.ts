import { prisma } from '@/lib/db/client';
import type { ProjectComparisonListResponse, ProjectComparisonSummary } from '@/lib/types/comparison';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

interface ComparisonPaginationInput {
  page?: number;
  pageSize?: number;
}

interface ProjectComparisonRecord {
  id: number;
  generatedAt: Date;
  sourceTicketId: number;
  markdownPath: string;
  summary: string;
  overallRecommendation: string;
  keyDifferentiators: unknown;
  winnerTicketId: number;
  sourceTicket: { ticketKey: string };
  winnerTicket: { ticketKey: string; title: string };
  participants: Array<{ ticketId: number; ticket: { ticketKey: string } }>;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function normalizeKeyDifferentiators(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

export function normalizeComparisonPagination(input: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number; skip: number } {
  const page = normalizePositiveInteger(input.page, DEFAULT_PAGE);
  const requestedPageSize = normalizePositiveInteger(input.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

function normalizeProjectComparisonSummary(record: ProjectComparisonRecord): ProjectComparisonSummary {
  return {
    id: record.id,
    generatedAt: record.generatedAt.toISOString(),
    sourceTicketId: record.sourceTicketId,
    sourceTicketKey: record.sourceTicket.ticketKey,
    participantTicketIds: record.participants.map((participant) => participant.ticketId),
    participantTicketKeys: record.participants.map((participant) => participant.ticket.ticketKey),
    winnerTicketId: record.winnerTicketId,
    winnerTicketKey: record.winnerTicket.ticketKey,
    winnerTicketTitle: record.winnerTicket.title,
    summary: record.summary,
    recommendation: record.overallRecommendation,
    overallRecommendation: record.overallRecommendation,
    keyDifferentiators: normalizeKeyDifferentiators(record.keyDifferentiators),
    markdownPath: record.markdownPath,
  };
}

export async function listProjectComparisons(
  projectId: number,
  input: ComparisonPaginationInput
): Promise<ProjectComparisonListResponse> {
  const { page, pageSize, skip } = normalizeComparisonPagination(input);

  const [records, total] = await prisma.$transaction([
    prisma.comparisonRecord.findMany({
      where: { projectId },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: pageSize,
      include: {
        sourceTicket: {
          select: {
            ticketKey: true,
          },
        },
        winnerTicket: {
          select: {
            ticketKey: true,
            title: true,
          },
        },
        participants: {
          orderBy: {
            rank: 'asc',
          },
          select: {
            ticketId: true,
            ticket: {
              select: {
                ticketKey: true,
              },
            },
          },
        },
      },
    }),
    prisma.comparisonRecord.count({
      where: { projectId },
    }),
  ]);

  return {
    comparisons: records.map(normalizeProjectComparisonSummary),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
