import { beforeEach, describe, expect, it } from 'vitest';
import { createComparisonReport } from '@/lib/comparison/comparison-generator';
import { persistComparisonRecord } from '@/lib/comparison/comparison-record';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createTestTicket } from '@/tests/helpers/db-setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('comparison persistence', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('persists one structured record alongside markdown metadata', async () => {
    const prisma = getPrismaClient();
    const sourceTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source',
      description: 'Source',
      ticketNumber: 201,
      ticketKey: 'TE2-201',
      stage: 'BUILD',
    });
    const candidateA = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate A',
      description: 'A',
      ticketNumber: 202,
      ticketKey: 'TE2-202',
      stage: 'VERIFY',
    });
    const candidateB = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate B',
      description: 'B',
      ticketNumber: 203,
      ticketKey: 'TE2-203',
      stage: 'PLAN',
    });

    const report = createComparisonReport(
      sourceTicket.ticketKey ?? 'TE2-201',
      [candidateA.ticketKey ?? 'TE2-202', candidateB.ticketKey ?? 'TE2-203'],
      {
        overall: 80,
        dimensions: { requirements: 80, scenarios: 80, entities: 80, keywords: 80 },
        isAligned: true,
        matchingRequirements: ['FR-001'],
        matchingEntities: ['Ticket'],
      },
      {
        'TE2-202': {
          ticketKey: 'TE2-202',
          linesAdded: 10,
          linesRemoved: 2,
          linesChanged: 12,
          filesChanged: 2,
          changedFiles: ['app/a.ts'],
          testFilesChanged: 1,
          hasData: true,
        },
        'TE2-203': {
          ticketKey: 'TE2-203',
          linesAdded: 20,
          linesRemoved: 4,
          linesChanged: 24,
          filesChanged: 3,
          changedFiles: ['app/b.ts'],
          testFilesChanged: 0,
          hasData: true,
        },
      },
      {
        'TE2-202': {
          overall: 90,
          totalPrinciples: 1,
          passedPrinciples: 1,
          principles: [{ name: 'TypeScript-First Development', section: 'I', passed: true, notes: '' }],
        },
        'TE2-203': {
          overall: 50,
          totalPrinciples: 1,
          passedPrinciples: 0,
          principles: [{ name: 'TypeScript-First Development', section: 'I', passed: false, notes: 'Gap' }],
        },
      },
      {},
      'Choose TE2-202.'
    );

    const record = await persistComparisonRecord({
      projectId: ctx.projectId,
      sourceTicket: {
        id: sourceTicket.id,
        ticketKey: sourceTicket.ticketKey ?? 'TE2-201',
        title: sourceTicket.title,
        stage: sourceTicket.stage,
        workflowType: sourceTicket.workflowType,
        agent: sourceTicket.agent,
      },
      participants: [candidateA, candidateB].map((ticket) => ({
        id: ticket.id,
        ticketKey: ticket.ticketKey ?? '',
        title: ticket.title,
        stage: ticket.stage,
        workflowType: ticket.workflowType,
        agent: ticket.agent,
      })),
      markdownPath: `specs/${sourceTicket.ticketKey}/comparisons/${report.metadata.filePath}`,
      report,
    });

    const persisted = await prisma.comparisonRecord.findUnique({
      where: { id: record.id },
      include: { participants: true, decisionPoints: true },
    });

    expect(persisted?.markdownPath).toContain('.md');
    expect(persisted?.participants).toHaveLength(2);
    expect(persisted?.decisionPoints).toHaveLength(1);
  });
});
