import type { Job, ClarificationPolicy } from '@prisma/client';
import { Stage } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { useTicketJobs } from '@/app/lib/hooks/queries/useTicketJobs';

export const STAGE_BY_NUMBER: Record<number, string> = {
  1: 'INBOX', 2: 'SPECIFY', 3: 'PLAN',
  4: 'BUILD', 5: 'VERIFY', 6: 'SHIP',
};

// AIB-512: Rollback confirmation messages (French per codebase convention)
export const ROLLBACK_MESSAGES: Record<string, { title: string; description: string }> = {
  'SPECIFY→INBOX': {
    title: 'Revenir a Inbox ?',
    description: 'La branche sera supprimee.',
  },
  'PLAN→SPECIFY': {
    title: 'Revenir a Specify ?',
    description: 'Le plan partiel sera ecrase au prochain lancement.',
  },
  'BUILD→PLAN': {
    title: 'Revenir a Plan ?',
    description: 'Le code sera reinitialise (backup cree).',
  },
  'VERIFY→BUILD': {
    title: 'Revenir a Build ?',
    description: 'Le code actuel sera conserve, verify sera relance.',
  },
};

/**
 * Convert TicketWithVersion to TicketDetailModal-compatible format
 * Handles JsonValue attachments conversion
 */
export function convertTicketForModal(ticket: TicketWithVersion | null) {
  if (!ticket) return null;

  const attachments = isTicketAttachmentArray(ticket.attachments)
    ? ticket.attachments
    : null;

  return {
    ...ticket,
    attachments,
  };
}

/** Default merge: apply server response fields to optimistic ticket */
export function mergeTransitionFields(serverData: Record<string, unknown>, current: TicketWithVersion): TicketWithVersion {
  const data = serverData as Partial<TicketWithVersion>;
  return {
    ...current,
    stage: data.stage || current.stage,
    version: data.version || current.version,
    branch: data.branch !== undefined ? data.branch : current.branch,
    workflowType: data.workflowType || current.workflowType,
    updatedAt: data.updatedAt || current.updatedAt,
  };
}

export function toBoardSnapshotJobs(
  jobs: ReturnType<typeof useTicketJobs>['data'],
  ticketId: number,
  projectId: number
): Job[] {
  if (!jobs || jobs.length === 0) {
    return [];
  }

  return jobs.map((job) => {
    const startedAt = new Date(job.startedAt);
    const completedAt = job.completedAt ? new Date(job.completedAt) : null;

    return {
      id: job.id,
      ticketId,
      projectId,
      command: job.command,
      status: job.status as Job['status'],
      workflowRunId: null,
      branch: job.branch,
      commitSha: null,
      logs: null,
      startedAt,
      completedAt,
      createdAt: startedAt,
      updatedAt: completedAt ?? startedAt,
      inputTokens: job.inputTokens,
      outputTokens: job.outputTokens,
      cacheReadTokens: job.cacheReadTokens,
      cacheCreationTokens: job.cacheCreationTokens,
      costUsd: job.costUsd,
      durationMs: job.durationMs,
      model: job.model,
      thinkingTokens: null,
      toolsUsed: job.toolsUsed,
      qualityScore: job.qualityScore,
      qualityScoreDetails: job.qualityScoreDetails,
      peakContextTokens: job.peakContextTokens,
      avgContextTokens: job.avgContextTokens,
      turnCount: job.turnCount,
      pluginVersion: job.pluginVersion,
      agentCliVersion: job.agentCliVersion,
    } satisfies Job;
  });
}

/** Shape of a ticket update payload from TicketDetailModal */
export type UpdatedModalTicket = {
  id: number;
  ticketNumber?: number;
  ticketKey?: string;
  title: string;
  description: string | null;
  stage: Stage | string;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  agent?: import('@prisma/client').Agent | null;
  specifyModel?: string | null;
  planModel?: string | null;
  implementModel?: string | null;
  quickImplModel?: string | null;
  verifyModel?: string | null;
  codexSpecifyModel?: string | null;
  codexPlanModel?: string | null;
  codexImplementModel?: string | null;
  codexQuickImplModel?: string | null;
  codexVerifyModel?: string | null;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  attachments?: import('@/app/lib/types/ticket').TicketAttachment[] | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

/** Normalize a modal-updated ticket back into TicketWithVersion shape, preserving fields from existing */
export function normalizeUpdatedTicket(
  updatedTicket: UpdatedModalTicket,
  existingTicket: TicketWithVersion | undefined
): TicketWithVersion {
  return {
    id: updatedTicket.id,
    ticketNumber: updatedTicket.ticketNumber ?? existingTicket?.ticketNumber ?? 0,
    ticketKey: updatedTicket.ticketKey ?? existingTicket?.ticketKey ?? '',
    title: updatedTicket.title,
    description: updatedTicket.description,
    stage: updatedTicket.stage as Stage,
    version: updatedTicket.version,
    projectId: updatedTicket.projectId,
    branch: updatedTicket.branch,
    autoMode: updatedTicket.autoMode,
    clarificationPolicy: updatedTicket.clarificationPolicy,
    agent: updatedTicket.agent ?? existingTicket?.agent ?? null,
    specifyModel:
      updatedTicket.specifyModel !== undefined
        ? updatedTicket.specifyModel
        : existingTicket?.specifyModel ?? null,
    planModel:
      updatedTicket.planModel !== undefined
        ? updatedTicket.planModel
        : existingTicket?.planModel ?? null,
    implementModel:
      updatedTicket.implementModel !== undefined
        ? updatedTicket.implementModel
        : existingTicket?.implementModel ?? null,
    quickImplModel:
      updatedTicket.quickImplModel !== undefined
        ? updatedTicket.quickImplModel
        : existingTicket?.quickImplModel ?? null,
    verifyModel:
      updatedTicket.verifyModel !== undefined
        ? updatedTicket.verifyModel
        : existingTicket?.verifyModel ?? null,
    codexSpecifyModel:
      updatedTicket.codexSpecifyModel !== undefined
        ? updatedTicket.codexSpecifyModel
        : existingTicket?.codexSpecifyModel ?? null,
    codexPlanModel:
      updatedTicket.codexPlanModel !== undefined
        ? updatedTicket.codexPlanModel
        : existingTicket?.codexPlanModel ?? null,
    codexImplementModel:
      updatedTicket.codexImplementModel !== undefined
        ? updatedTicket.codexImplementModel
        : existingTicket?.codexImplementModel ?? null,
    codexQuickImplModel:
      updatedTicket.codexQuickImplModel !== undefined
        ? updatedTicket.codexQuickImplModel
        : existingTicket?.codexQuickImplModel ?? null,
    codexVerifyModel:
      updatedTicket.codexVerifyModel !== undefined
        ? updatedTicket.codexVerifyModel
        : existingTicket?.codexVerifyModel ?? null,
    workflowType: updatedTicket.workflowType || existingTicket?.workflowType || 'FULL',
    attachments: (updatedTicket.attachments ?? existingTicket?.attachments ?? []) as import('@prisma/client').Prisma.JsonValue,
    qualityScore: existingTicket?.qualityScore ?? null,
    createdAt:
      updatedTicket.createdAt instanceof Date
        ? updatedTicket.createdAt.toISOString()
        : updatedTicket.createdAt,
    updatedAt:
      updatedTicket.updatedAt instanceof Date
        ? updatedTicket.updatedAt.toISOString()
        : updatedTicket.updatedAt,
  };
}
