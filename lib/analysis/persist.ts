import type { Prisma, Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ANALYSIS_RULE_SET_VERSION, StackContextSchema, type StackContext } from './types';
import { AnalysisInputSnapshotSchema } from './input-schema';

export interface InsertRunningAnalysisInput {
  ticketId: number;
  projectId: number;
  userId: string;
  agent: Agent;
  modelId: string | null;
  titleSnapshot: string;
  descriptionSnapshot: string;
  stackSnapshot: StackContext;
  anchorIdsAttempted: number[];
}

export async function insertRunningAnalysis(
  input: InsertRunningAnalysisInput
) {
  AnalysisInputSnapshotSchema.parse({
    titleSnapshot: input.titleSnapshot,
    descriptionSnapshot: input.descriptionSnapshot,
  });
  StackContextSchema.parse(input.stackSnapshot);

  const data: Prisma.TicketAnalysisUncheckedCreateInput = {
    ticketId: input.ticketId,
    projectId: input.projectId,
    userId: input.userId,
    agent: input.agent,
    modelId: input.modelId,
    titleSnapshot: input.titleSnapshot,
    descriptionSnapshot: input.descriptionSnapshot,
    stackSnapshot: input.stackSnapshot as unknown as Prisma.InputJsonValue,
    ruleSetVersion: ANALYSIS_RULE_SET_VERSION,
    anchorIdsAttempted: input.anchorIdsAttempted,
    status: 'running',
  };

  return prisma.ticketAnalysis.create({ data });
}

// The inbox-analysis workflow caps the agent step at 5 minutes
// (timeout-minutes in inbox-analysis.yml); a row still `running` after this
// window means the terminal status PATCH never landed (workflow crash,
// rejected payload, network failure). Without reclaim such rows block new
// analyses (POST returns 409) and keep the UI polling forever — there is no
// background janitor, so GET/POST reclaim lazily.
export const STALE_RUNNING_ANALYSIS_MS = 10 * 60 * 1000;

export async function reclaimStaleRunningAnalyses(ticketId: number): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUNNING_ANALYSIS_MS);
  const { count } = await prisma.ticketAnalysis.updateMany({
    where: { ticketId, status: 'running', startedAt: { lt: cutoff } },
    data: {
      status: 'failed',
      errorReason: 'timeout',
      errorMessage:
        'Analysis exceeded the maximum runtime without reporting a result and was reclaimed.',
      endedAt: new Date(),
    },
  });
  return count;
}
