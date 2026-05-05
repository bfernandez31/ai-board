import { prisma } from '@/lib/db/client';
import { pairAnalysisWithOutcome } from './pair';

const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;
const PENDING_LIMIT = 1000;
const CATCH_UP_LIMIT = 500;
const CATCH_UP_DAYS = 7;

export interface SweepResult {
  examinedPending: number;
  pairedNow: number;
  expired: number;
  windowHours: number;
}

export async function sweepUnpairedPairings(): Promise<SweepResult> {
  const counters = { examinedPending: 0, pairedNow: 0, expired: 0 };
  const now = Date.now();

  // Phase 1 — Pending rows
  const pendingRows = await prisma.analysisOutcomePairing.findMany({
    where: { pendingOutcome: true, unpairedReason: null },
    orderBy: { shippedAt: 'asc' },
    take: PENDING_LIMIT,
    select: { ticketId: true, shippedAt: true },
  });

  counters.examinedPending = pendingRows.length;

  for (const row of pendingRows) {
    try {
      const ageMs = now - row.shippedAt.getTime();
      if (ageMs > WINDOW_MS) {
        await prisma.analysisOutcomePairing.update({
          where: { ticketId: row.ticketId },
          data: { pendingOutcome: false, unpairedReason: 'outcome_missing_24h' },
        });
        counters.expired += 1;
      } else {
        const result = await pairAnalysisWithOutcome(row.ticketId);
        if (result.paired) counters.pairedNow += 1;
      }
    } catch (err) {
      console.error('[drift-sweep] per-ticket error', { ticketId: row.ticketId, err });
    }
  }

  // Phase 2 — Tickets-without-row in last 7 days
  const catchUpCutoff = new Date(now - CATCH_UP_DAYS * 24 * 60 * 60 * 1000);

  const catchUpTickets = await prisma.$queryRaw<Array<{ ticketId: number; shippedAt: Date }>>`
    SELECT t.id AS "ticketId", t."updatedAt" AS "shippedAt"
    FROM "Ticket" t
    JOIN "TicketAnalysis" a ON a."ticketId" = t.id AND a.status = 'success'
    LEFT JOIN "AnalysisOutcomePairing" p ON p."ticketId" = t.id
    WHERE t.stage = 'SHIP'
      AND p.id IS NULL
      AND t."updatedAt" > ${catchUpCutoff}
    LIMIT ${CATCH_UP_LIMIT}
  `;

  for (const candidate of catchUpTickets) {
    try {
      const ageMs = now - candidate.shippedAt.getTime();
      if (ageMs > WINDOW_MS) {
        const analysis = await prisma.ticketAnalysis.findFirst({
          where: { ticketId: candidate.ticketId, status: 'success' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        const ticket = await prisma.ticket.findUnique({
          where: { id: candidate.ticketId },
          select: { projectId: true },
        });
        if (analysis && ticket) {
          await prisma.analysisOutcomePairing.upsert({
            where: { ticketId: candidate.ticketId },
            create: {
              ticketId: candidate.ticketId,
              projectId: ticket.projectId,
              analysisId: analysis.id,
              shippedAt: candidate.shippedAt,
              pendingOutcome: false,
              unpairedReason: 'outcome_missing_24h',
              predictedFriction: 'low',
              actualFrictionFree: false,
              frictionPredictedLow: false,
              frictionMatch: false,
              frictionEmerged: false,
              frictionIncomparable: true,
              costIncomparable: true,
              qualityIncomparable: true,
              predictedRecommendation: 'FULL',
              actualWorkflowType: 'FULL',
              recommendationMatch: false,
              recommendationIncomparable: true,
            },
            update: { pendingOutcome: false, unpairedReason: 'outcome_missing_24h' },
          });
          counters.expired += 1;
        }
      } else {
        const result = await pairAnalysisWithOutcome(candidate.ticketId);
        if (result.paired) counters.pairedNow += 1;
      }
    } catch (err) {
      console.error('[drift-sweep] catch-up error', { ticketId: candidate.ticketId, err });
    }
  }

  console.log('[drift-sweep] completed', { ...counters, windowHours: WINDOW_HOURS });

  return { ...counters, windowHours: WINDOW_HOURS };
}
