import { prisma } from '@/lib/db/client';
import type { DriftDashboardSnapshot, DriftFilters, DriftRecentPairing } from './types';

const DEFAULT_PAGE_SIZE = 30;

function roundTo3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function decodeCursor(cursor: string): { shippedAt: string; id: number } | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function encodeCursor(shippedAt: Date, id: number): string {
  return Buffer.from(JSON.stringify({ shippedAt: shippedAt.toISOString(), id })).toString('base64');
}

export async function getDriftData(
  projectId: number,
  filters: DriftFilters = {}
): Promise<DriftDashboardSnapshot> {
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;

  // Aggregate paired rows (unpairedReason IS NULL and pendingOutcome=false)
  const paired = await prisma.analysisOutcomePairing.findMany({
    where: { projectId, unpairedReason: null, pendingOutcome: false },
    select: {
      frictionPredictedLow: true,
      frictionMatch: true,
      frictionIncomparable: true,
      costInRange: true,
      costMissDirection: true,
      costIncomparable: true,
      qualityInRange: true,
      qualityMissDirection: true,
      qualityIncomparable: true,
    },
  });

  const sampleSize = paired.length;

  // Friction confusion matrix
  let tp = 0, fp = 0, tn = 0, fn = 0, frictionIncomparable = 0;
  for (const p of paired) {
    if (p.frictionIncomparable) { frictionIncomparable++; continue; }
    if (p.frictionPredictedLow && p.frictionMatch) tp++;         // predicted low, actual low
    else if (!p.frictionPredictedLow && !p.frictionMatch) fp++;  // predicted not-low, actual low → FP
    else if (!p.frictionPredictedLow && p.frictionMatch) tn++;   // predicted not-low, actual not-low
    else fn++;                                                     // predicted low, actual not-low
  }

  const precision = tp + fp === 0 ? null : roundTo3(tp / (tp + fp));
  const recall = tp + fn === 0 ? null : roundTo3(tp / (tp + fn));

  // Cost panel
  let costInRange = 0, costUnder = 0, costOver = 0, costIncomparable = 0;
  for (const p of paired) {
    if (p.costIncomparable) { costIncomparable++; continue; }
    if (p.costInRange) costInRange++;
    else if (p.costMissDirection === 'under') costUnder++;
    else costOver++;
  }

  // Quality panel
  let qualInRange = 0, qualUnder = 0, qualOver = 0, qualIncomparable = 0;
  for (const p of paired) {
    if (p.qualityIncomparable) { qualIncomparable++; continue; }
    if (p.qualityInRange) qualInRange++;
    else if (p.qualityMissDirection === 'under') qualUnder++;
    else qualOver++;
  }

  // Counts for unpairedCount, pendingCount, analysedShipped
  const [unpairedCount, pendingCount] = await Promise.all([
    prisma.analysisOutcomePairing.count({
      where: { projectId, unpairedReason: { not: null } },
    }),
    prisma.analysisOutcomePairing.count({
      where: { projectId, pendingOutcome: true },
    }),
  ]);

  const analysedShipped = await prisma.analysisOutcomePairing.count({
    where: { projectId, pendingOutcome: false },
  });

  const leftInbox = await prisma.ticket.count({
    where: { projectId, stage: { not: 'INBOX' } },
  });

  const ratio = leftInbox === 0 ? 0 : roundTo3(analysedShipped / leftInbox);

  // Recent pairings with cursor-based pagination
  const rawRecent = await prisma.analysisOutcomePairing.findMany({
    where: {
      projectId,
      unpairedReason: null,
      pendingOutcome: false,
      ...(cursor
        ? {
            OR: [
              { shippedAt: { lt: new Date(cursor.shippedAt) } },
              { shippedAt: new Date(cursor.shippedAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ shippedAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
    select: {
      id: true,
      ticketId: true,
      shippedAt: true,
      frictionMatch: true,
      frictionIncomparable: true,
      costInRange: true,
      costIncomparable: true,
      qualityInRange: true,
      qualityIncomparable: true,
      recommendationMatch: true,
      recommendationIncomparable: true,
      ticket: {
        select: { ticketKey: true },
      },
    },
  });
  const hasMore = rawRecent.length > pageSize;
  const pageRows = hasMore ? rawRecent.slice(0, pageSize) : rawRecent;

  const recentPairings: DriftRecentPairing[] = pageRows.map((r) => ({
    ticketId: r.ticketId,
    ticketKey: r.ticket.ticketKey,
    shippedAt: r.shippedAt.toISOString(),
    frictionMatch: r.frictionIncomparable ? null : r.frictionMatch,
    costInRange: r.costIncomparable ? null : r.costInRange,
    qualityInRange: r.qualityIncomparable ? null : r.qualityInRange,
    recommendationMatch: r.recommendationIncomparable ? null : r.recommendationMatch,
  }));

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow ? encodeCursor(lastRow.shippedAt, lastRow.id) : null;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    sampleSize,
    unpairedCount,
    pendingCount,
    friction: {
      incomparable: frictionIncomparable,
      matrix: { tp, fp, tn, fn },
      precision,
      recall,
    },
    cost: { incomparable: costIncomparable, inRange: costInRange, under: costUnder, over: costOver },
    quality: { incomparable: qualIncomparable, inRange: qualInRange, under: qualUnder, over: qualOver },
    usage: { analysedShipped, leftInbox, ratio },
    recentPairings,
    nextCursor,
  };
}
