import { prisma } from '@/lib/db/client';
import type { AnchorCitation } from './output-schema';

export interface SelectAnchorsResult {
  /** Top-5 anchors for prompt + UI projection */
  anchors: AnchorCitation[];
  /** Up to 50 candidate ticketIds passed to scoping (persisted as anchorIdsAttempted) */
  candidateTicketIds: number[];
  coldStart: boolean;
  reason: 'insufficient_comparable_history' | null;
}

interface ScoringHints {
  tagHints?: {
    touchesDbSchema?: boolean;
    touchesTests?: boolean;
    touchesCi?: boolean;
  };
}

const COLD_START_THRESHOLD = 3;
const TOP_ANCHORS = 5;
const MAX_CANDIDATES = 50;

export async function selectAnchors(
  projectId: number,
  predictedDomains: string[],
  scoringHints?: ScoringHints
): Promise<SelectAnchorsResult> {
  const outcomes = await prisma.ticketOutcome.findMany({
    where: { projectId, partial: false },
    include: { ticket: { select: { ticketKey: true } } },
    orderBy: { shippedAt: 'desc' },
    take: 500,
  });

  const predictedSet = new Set(predictedDomains);
  const tagHints = scoringHints?.tagHints ?? {};

  const scored = outcomes.map((row) => {
    const overlap = (row.domains ?? []).reduce(
      (acc, d) => acc + (predictedSet.has(d) ? 1 : 0),
      0
    );
    const tagOverlap =
      (tagHints.touchesDbSchema && row.touchedDbSchema ? 1 : 0) +
      (tagHints.touchesTests && row.touchedTests ? 1 : 0) +
      (tagHints.touchesCi && row.touchedCi ? 1 : 0);
    return { row, overlap, tagOverlap };
  });

  scored.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    if (b.tagOverlap !== a.tagOverlap) return b.tagOverlap - a.tagOverlap;
    return b.row.shippedAt.getTime() - a.row.shippedAt.getTime();
  });

  const candidateTicketIds = scored.slice(0, MAX_CANDIDATES).map((s) => s.row.ticketId);

  const qualifying = scored.filter((s) => s.overlap >= 1);

  if (qualifying.length < COLD_START_THRESHOLD) {
    return {
      anchors: [],
      candidateTicketIds,
      coldStart: true,
      reason: 'insufficient_comparable_history',
    };
  }

  const anchors: AnchorCitation[] = qualifying.slice(0, TOP_ANCHORS).map((s) => ({
    ticketId: s.row.ticketId,
    ticketKey: s.row.ticket.ticketKey,
    frictionFree: s.row.frictionFree,
    qualityScore: s.row.qualityScore,
    overlapStrength: s.overlap,
  }));

  return {
    anchors,
    candidateTicketIds,
    coldStart: false,
    reason: null,
  };
}
