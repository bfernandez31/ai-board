/**
 * Shared seed helpers for calibration integration tests.
 */
import { JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { AnalysisOutput } from '@/lib/analysis/output-schema';

const prisma = getPrismaClient();

export const DEFAULT_ANALYSIS_OUTPUT: AnalysisOutput = {
  frictionRisk: 'low',
  qualityGateRange: { lower: 70, upper: 90 },
  recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'test' },
  costRange: {
    baselineLowerUsd: 1,
    baselineUpperUsd: 2,
    marginalFrictionLowerUsd: 0.5,
    marginalFrictionUpperUsd: 1.5,
  },
  scopeWarnings: [],
  anchors: [],
};

let nonceCounter = 0;
function uniqueNonce(): string {
  nonceCounter += 1;
  return `${Date.now().toString(36)}-${process.pid}-${nonceCounter}`;
}

export interface SeedTicketOpts {
  projectId: number;
  userId: string;
  workflowType?: WorkflowType;
  ticketNumber?: number;
  title?: string;
  branch?: string | null;
}

export async function seedTicket(opts: SeedTicketOpts) {
  const ticketNumber = opts.ticketNumber ?? Math.floor(Math.random() * 1_000_000);
  return prisma.ticket.create({
    data: {
      projectId: opts.projectId,
      title: opts.title ?? `[e2e] calibration ${ticketNumber}`,
      description: 'calibration integration test',
      stage: Stage.SHIP,
      workflowType: opts.workflowType ?? WorkflowType.FULL,
      ticketNumber,
      ticketKey: `E2E-CAL-${uniqueNonce()}`,
      branch: opts.branch === undefined ? `cal-${ticketNumber}` : opts.branch,
      updatedAt: new Date(),
    },
  });
}

export interface SeedAnalysisOpts {
  ticketId: number;
  projectId: number;
  userId: string;
  status?: 'running' | 'success' | 'cold_start' | 'failed';
  output?: AnalysisOutput | null;
  createdAt?: Date;
}

export async function seedAnalysis(opts: SeedAnalysisOpts) {
  const status = opts.status ?? 'success';
  const output =
    opts.output === undefined
      ? status === 'success'
        ? DEFAULT_ANALYSIS_OUTPUT
        : null
      : opts.output;
  return prisma.ticketAnalysis.create({
    data: {
      ticketId: opts.ticketId,
      projectId: opts.projectId,
      userId: opts.userId,
      status,
      ruleSetVersion: 1,
      agent: 'CLAUDE',
      titleSnapshot: 't',
      descriptionSnapshot: 'd',
      stackSnapshot: {
        language: 'typescript',
        framework: 'nextjs',
        services: [],
        testingFramework: null,
        e2e: false,
        e2eFramework: null,
        agent: { cli: 'claude-code', model: null },
      },
      output: output as object | null,
      createdAt: opts.createdAt ?? new Date(),
    },
  });
}

export interface SeedOutcomeOpts {
  ticketId: number;
  projectId: number;
  workflowType?: WorkflowType;
  qualityScore?: number | null;
  totalCostUsd?: number | null;
  frictionFree?: boolean;
  frictionJobCount?: number;
  partial?: boolean;
  partialReason?: string | null;
  shippedAt?: Date;
}

export async function seedOutcome(opts: SeedOutcomeOpts) {
  return prisma.ticketOutcome.create({
    data: {
      ticketId: opts.ticketId,
      projectId: opts.projectId,
      workflowType: opts.workflowType ?? WorkflowType.FULL,
      shippedAt: opts.shippedAt ?? new Date(),
      ruleSetVersion: 1,
      qualityScore: opts.qualityScore ?? 80,
      totalCostUsd: opts.totalCostUsd ?? 2.5,
      frictionFree: opts.frictionFree ?? true,
      pipelineJobCount: 1,
      frictionJobCount: opts.frictionJobCount ?? 0,
      totalJobCount: 1,
      partial: opts.partial ?? false,
      partialReason: opts.partialReason ?? null,
    },
  });
}

export async function ensureUser(userId: string) {
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: `${userId}@e2e.local`,
      name: 'cal-e2e',
      updatedAt: new Date(),
    },
    update: {},
  });
}

export { prisma, JobStatus, Stage, WorkflowType };
