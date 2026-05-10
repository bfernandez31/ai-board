import type { AdminInsightsReport } from '@prisma/client';
import { getPrismaClient } from './db-cleanup';

export interface SeedReportInput {
  periodStart?: Date;
  periodEnd?: Date;
  sessionsCount?: number;
  ticketsCount?: number;
  htmlBody?: string;
  triggeredById?: string | null;
  errorReason?: string;
  startedAt?: Date;
  completedAt?: Date;
  workflowRunId?: bigint | null;
  htmlBlobKey?: string;
  htmlBlobSize?: number;
}

const DAY = 24 * 60 * 60 * 1000;

function defaultPeriod(now: Date): { periodStart: Date; periodEnd: Date } {
  return {
    periodStart: new Date(now.getTime() - 7 * DAY),
    periodEnd: now,
  };
}

export interface SeededAdminAllowlistedUser {
  id: string;
  email: string;
}

/**
 * Upserts a seeded test user, sets ADMIN_ALLOWLIST_EMAILS to include them,
 * and returns the user info. Note: callers must restore env after the test
 * if they care about isolation across describe blocks.
 */
export async function seedAdminAllowlistedUser(
  email = 'e2e-admin@e2e.local'
): Promise<SeededAdminAllowlistedUser> {
  const prisma = getPrismaClient();
  const id = `e2e-admin-${email.replace(/[^a-z0-9]/gi, '-')}`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id,
      email,
      name: 'E2E Admin User',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });
  // Caller is responsible for setting process.env.ADMIN_ALLOWLIST_EMAILS;
  // we surface the email so the test can do that.
  return { id: user.id, email: user.email };
}

export async function seedCompletedInsightsReport(
  input: SeedReportInput = {}
): Promise<AdminInsightsReport> {
  const prisma = getPrismaClient();
  const now = new Date();
  const { periodStart, periodEnd } = {
    ...defaultPeriod(now),
    ...(input.periodStart ? { periodStart: input.periodStart } : {}),
    ...(input.periodEnd ? { periodEnd: input.periodEnd } : {}),
  };
  const report = await prisma.adminInsightsReport.create({
    data: {
      status: 'COMPLETED',
      periodStart,
      periodEnd,
      sessionsCount: input.sessionsCount ?? 12,
      ticketsCount: input.ticketsCount ?? 4,
      htmlBlobKey: input.htmlBlobKey ?? null,
      htmlBlobSize: input.htmlBlobSize ?? null,
      triggeredById: input.triggeredById ?? null,
      workflowRunId: input.workflowRunId ?? null,
      startedAt: input.startedAt ?? periodEnd,
      completedAt:
        input.completedAt ?? new Date(periodEnd.getTime() + 60_000),
    },
  });
  return report;
}

export async function seedRunningInsightsReport(
  input: SeedReportInput = {}
): Promise<AdminInsightsReport> {
  const prisma = getPrismaClient();
  const now = new Date();
  const { periodStart, periodEnd } = {
    ...defaultPeriod(now),
    ...(input.periodStart ? { periodStart: input.periodStart } : {}),
    ...(input.periodEnd ? { periodEnd: input.periodEnd } : {}),
  };
  const report = await prisma.adminInsightsReport.create({
    data: {
      status: 'RUNNING',
      periodStart,
      periodEnd,
      triggeredById: input.triggeredById ?? null,
      workflowRunId: input.workflowRunId ?? null,
      startedAt: input.startedAt ?? new Date(),
    },
  });
  return report;
}

export async function seedFailedInsightsReport(
  input: SeedReportInput = {}
): Promise<AdminInsightsReport> {
  const prisma = getPrismaClient();
  const now = new Date();
  const { periodStart, periodEnd } = {
    ...defaultPeriod(now),
    ...(input.periodStart ? { periodStart: input.periodStart } : {}),
    ...(input.periodEnd ? { periodEnd: input.periodEnd } : {}),
  };
  const report = await prisma.adminInsightsReport.create({
    data: {
      status: 'FAILED',
      periodStart,
      periodEnd,
      errorReason: input.errorReason ?? 'Insights analyzer exited non-zero',
      triggeredById: input.triggeredById ?? null,
      workflowRunId: input.workflowRunId ?? null,
      startedAt: input.startedAt ?? periodEnd,
      completedAt:
        input.completedAt ?? new Date(periodEnd.getTime() + 60_000),
    },
  });
  return report;
}

export async function deleteAllInsightsReports(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.adminInsightsReport.deleteMany({});
}
