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
