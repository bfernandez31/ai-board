import { getPrismaClient } from './db-cleanup';
import { createTestTicket } from './db-setup';

export async function createStructuredComparisonFixture(projectId: number) {
  const prisma = getPrismaClient();
  const sourceTicket = await createTestTicket(projectId, {
    title: '[e2e] Source ticket',
    description: 'Source comparison ticket',
    ticketNumber: 101,
    ticketKey: 'TE2-101',
    stage: 'BUILD',
  });
  const winnerTicket = await createTestTicket(projectId, {
    title: '[e2e] Winner ticket',
    description: 'Winner comparison ticket',
    ticketNumber: 102,
    ticketKey: 'TE2-102',
    stage: 'VERIFY',
  });
  const otherTicket = await createTestTicket(projectId, {
    title: '[e2e] Other ticket',
    description: 'Another comparison ticket',
    ticketNumber: 103,
    ticketKey: 'TE2-103',
    stage: 'PLAN',
  });

  await prisma.job.createMany({
    data: [
      {
        ticketId: winnerTicket.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        qualityScore: 91,
        inputTokens: 1200,
        outputTokens: 400,
        costUsd: 0.08,
        durationMs: 120000,
        startedAt: new Date('2026-03-19T10:00:00.000Z'),
        completedAt: new Date('2026-03-19T10:02:00.000Z'),
        updatedAt: new Date('2026-03-19T10:02:00.000Z'),
      },
      {
        ticketId: otherTicket.id,
        projectId,
        command: 'implement',
        status: 'COMPLETED',
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        durationMs: null,
        startedAt: new Date('2026-03-19T11:00:00.000Z'),
        completedAt: new Date('2026-03-19T11:05:00.000Z'),
        updatedAt: new Date('2026-03-19T11:05:00.000Z'),
      },
    ],
  });

  const comparison = await prisma.comparisonRecord.create({
    data: {
      projectId,
      sourceTicketId: sourceTicket.id,
      winnerTicketId: winnerTicket.id,
      markdownPath: `specs/${sourceTicket.ticketKey}/comparisons/example.md`,
      summary: 'Winner ticket had the best test coverage and smallest diff.',
      overallRecommendation: 'Choose TE2-102 for the implementation baseline.',
      keyDifferentiators: ['coverage', 'smaller diff'],
      generatedAt: new Date('2026-03-20T09:00:00.000Z'),
      participants: {
        create: [
          {
            ticketId: winnerTicket.id,
            rank: 1,
            score: 91,
            workflowTypeAtComparison: 'FULL',
            rankRationale: 'Strong verify results and concise implementation.',
            metricSnapshot: {
              create: {
                linesAdded: 20,
                linesRemoved: 5,
                linesChanged: 25,
                filesChanged: 3,
                testFilesChanged: 2,
                changedFiles: ['app/a.ts', 'tests/a.test.ts'],
                bestValueFlags: {
                  linesChanged: true,
                  filesChanged: true,
                  testFilesChanged: true,
                },
              },
            },
            complianceAssessments: {
              create: [
                {
                  principleKey: 'typescript-first-development',
                  principleName: 'TypeScript-First Development',
                  status: 'pass',
                  notes: 'Strict types retained.',
                  displayOrder: 0,
                },
              ],
            },
          },
          {
            ticketId: otherTicket.id,
            rank: 2,
            score: 75,
            workflowTypeAtComparison: 'FULL',
            rankRationale: 'Good direction but less complete test coverage.',
            metricSnapshot: {
              create: {
                linesAdded: 50,
                linesRemoved: 15,
                linesChanged: 65,
                filesChanged: 5,
                testFilesChanged: 1,
                changedFiles: ['app/b.ts'],
                bestValueFlags: {
                  linesChanged: false,
                  filesChanged: false,
                  testFilesChanged: false,
                },
              },
            },
            complianceAssessments: {
              create: [
                {
                  principleKey: 'typescript-first-development',
                  principleName: 'TypeScript-First Development',
                  status: 'mixed',
                  notes: 'Some typing gaps remain.',
                  displayOrder: 0,
                },
              ],
            },
          },
        ],
      },
      decisionPoints: {
        create: [
          {
            title: 'State handling',
            verdictTicketId: winnerTicket.id,
            verdictSummary: 'TE2-102 handled pending states cleanly.',
            rationale: 'The winner kept unavailable telemetry explicit.',
            participantApproaches: [
              {
                ticketId: winnerTicket.id,
                ticketKey: winnerTicket.ticketKey,
                summary: 'Used explicit pending/unavailable states.',
              },
              {
                ticketId: otherTicket.id,
                ticketKey: otherTicket.ticketKey,
                summary: 'Collapsed missing data into empty strings.',
              },
            ],
            displayOrder: 0,
          },
        ],
      },
    },
  });

  return {
    sourceTicket,
    winnerTicket,
    otherTicket,
    comparison,
  };
}
