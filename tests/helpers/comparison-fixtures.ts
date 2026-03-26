import { getPrismaClient } from './db-cleanup';
import { createTestTicket } from './db-setup';
import { createComparisonReport, generateReportPath } from '@/lib/comparison/comparison-generator';
import {
  createCompareRunKey,
  createComparisonPersistenceRequest,
} from '@/lib/comparison/comparison-payload';

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
        command: 'implement',
        status: 'COMPLETED',
        inputTokens: 600,
        outputTokens: 300,
        costUsd: 0.04,
        durationMs: 60000,
        model: 'gpt-5.4-mini',
        startedAt: new Date('2026-03-19T09:00:00.000Z'),
        completedAt: new Date('2026-03-19T09:01:00.000Z'),
        updatedAt: new Date('2026-03-19T09:01:00.000Z'),
      },
      {
        ticketId: winnerTicket.id,
        projectId,
        command: 'verify',
        status: 'COMPLETED',
        qualityScore: 91,
        qualityScoreDetails: JSON.stringify({
          dimensions: [
            {
              name: 'Compliance',
              agentId: 'compliance',
              score: 92,
              weight: 0.4,
              weightedScore: 36.8,
            },
            {
              name: 'Bug Detection',
              agentId: 'bug-detection',
              score: 88,
              weight: 0.3,
              weightedScore: 26.4,
            },
            {
              name: 'Code Comments',
              agentId: 'code-comments',
              score: 80,
              weight: 0.2,
              weightedScore: 16,
            },
            {
              name: 'Historical Context',
              agentId: 'historical-context',
              score: 77,
              weight: 0.1,
              weightedScore: 7.7,
            },
            {
              name: 'Spec Sync',
              agentId: 'spec-sync',
              score: 100,
              weight: 0,
              weightedScore: 0,
            },
          ],
          threshold: 'Excellent',
          computedAt: '2026-03-19T10:02:00.000Z',
        }),
        inputTokens: 1200,
        outputTokens: 400,
        costUsd: 0.08,
        durationMs: 120000,
        model: 'gpt-5.4',
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
        model: 'gpt-5.4',
        startedAt: new Date('2026-03-19T11:00:00.000Z'),
        completedAt: new Date('2026-03-19T11:05:00.000Z'),
        updatedAt: new Date('2026-03-19T11:05:00.000Z'),
      },
      {
        ticketId: otherTicket.id,
        projectId,
        command: 'verify',
        status: 'RUNNING',
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        durationMs: null,
        model: 'gpt-5.4-mini',
        startedAt: new Date('2026-03-19T11:10:00.000Z'),
        completedAt: null,
        updatedAt: new Date('2026-03-19T11:10:00.000Z'),
      },
    ],
  });

  const comparison = await prisma.comparisonRecord.create({
    data: {
      projectId,
      sourceTicketId: sourceTicket.id,
      winnerTicketId: winnerTicket.id,
      compareRunKey: 'cmp_fixture_te2_101_102_103',
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
            agentAtComparison: 'CLAUDE',
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
            agentAtComparison: 'CODEX',
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

export function createWorkflowComparisonReportFixture(sourceTicketKey: string, comparedTickets: string[]) {
  return createComparisonReport(
    sourceTicketKey,
    comparedTickets,
    {
      overall: 80,
      dimensions: {
        requirements: 80,
        scenarios: 80,
        entities: 80,
        keywords: 80,
      },
      isAligned: true,
      matchingRequirements: ['FR-001'],
      matchingEntities: ['Ticket'],
    },
    Object.fromEntries(
      comparedTickets.map((ticketKey, index) => [
        ticketKey,
        {
          ticketKey,
          linesAdded: 10 + index * 10,
          linesRemoved: 2 + index * 2,
          linesChanged: 12 + index * 12,
          filesChanged: 2 + index,
          changedFiles: [`app/${ticketKey.toLowerCase()}.ts`],
          testFilesChanged: index === 0 ? 1 : 0,
          hasData: true,
        },
      ])
    ),
    Object.fromEntries(
      comparedTickets.map((ticketKey, index) => [
        ticketKey,
        {
          overall: index === 0 ? 90 : 50,
          totalPrinciples: 1,
          passedPrinciples: index === 0 ? 1 : 0,
          principles: [
            {
              name: 'TypeScript-First Development',
              section: 'I',
              passed: index === 0,
              notes: index === 0 ? '' : 'Gap',
            },
          ],
        },
      ])
    ),
    {},
    `Choose ${comparedTickets[0]}.`
  );
}

export function createWorkflowComparisonPayloadFixture(input: {
  projectId: number;
  branch: string;
  sourceTicket: { ticketKey: string };
  participants: Array<{ ticketKey: string }>;
}) {
  const report = createWorkflowComparisonReportFixture(
    input.sourceTicket.ticketKey,
    input.participants.map((participant) => participant.ticketKey)
  );
  const markdownPath = generateReportPath(input.branch, report.metadata.filePath);
  const hydratedReport = {
    ...report,
    metadata: {
      ...report.metadata,
      filePath: markdownPath,
    },
  };

  return createComparisonPersistenceRequest({
    compareRunKey: createCompareRunKey(
      input.sourceTicket.ticketKey,
      hydratedReport.metadata.comparedTickets,
      hydratedReport.metadata.generatedAt
    ),
    projectId: input.projectId,
    sourceTicketKey: input.sourceTicket.ticketKey,
    participantTicketKeys: input.participants.map((participant) => participant.ticketKey),
    markdownPath,
    report: hydratedReport,
  });
}

export async function createWideComparisonFixture(projectId: number, participantCount = 6) {
  const prisma = getPrismaClient();
  const sourceTicket = await createTestTicket(projectId, {
    title: '[e2e] Wide source ticket',
    description: 'Source comparison ticket',
    ticketNumber: 151,
    ticketKey: 'TE2-151',
    stage: 'BUILD',
  });

  const participants = await Promise.all(
    Array.from({ length: participantCount }, async (_, index) => {
      const ticketNumber = 152 + index;
      return createTestTicket(projectId, {
        title: `[e2e] Wide ticket ${index + 1}`,
        description: `Wide comparison ticket ${index + 1}`,
        ticketNumber,
        ticketKey: `TE2-${ticketNumber}`,
        stage: index % 2 === 0 ? 'VERIFY' : 'PLAN',
      });
    })
  );

  await prisma.job.createMany({
    data: participants.map((ticket, index) => ({
      ticketId: ticket.id,
      projectId,
      command: 'implement',
      status: 'COMPLETED',
      inputTokens: 100 + index * 10,
      outputTokens: 40 + index * 5,
      costUsd: 0.02 + index * 0.01,
      durationMs: 1000 + index * 200,
      model: index % 2 === 0 ? 'gpt-5.4' : 'gpt-5.4-mini',
      startedAt: new Date(`2026-03-21T10:0${index}:00.000Z`),
      completedAt: new Date(`2026-03-21T10:0${index}:30.000Z`),
      updatedAt: new Date(`2026-03-21T10:0${index}:30.000Z`),
    })),
  });

  const comparison = await prisma.comparisonRecord.create({
    data: {
      projectId,
      sourceTicketId: sourceTicket.id,
      winnerTicketId: participants[0]!.id,
      compareRunKey: `cmp_fixture_wide_${participantCount}`,
      markdownPath: `specs/${sourceTicket.ticketKey}/comparisons/wide.md`,
      summary: 'Wide comparison fixture for responsive layout testing.',
      overallRecommendation: `Choose ${participants[0]!.ticketKey} for the baseline.`,
      keyDifferentiators: ['layout', 'scroll'],
      generatedAt: new Date('2026-03-21T09:00:00.000Z'),
      participants: {
        create: participants.map((ticket, index) => ({
          ticketId: ticket.id,
          rank: index + 1,
          score: 95 - index * 5,
          workflowTypeAtComparison: 'FULL',
          agentAtComparison: index % 2 === 0 ? 'CLAUDE' : 'CODEX',
          rankRationale: `Ranked ${index + 1} in the wide comparison fixture.`,
          metricSnapshot: {
            create: {
              linesAdded: 10 + index,
              linesRemoved: 2 + index,
              linesChanged: 12 + index * 2,
              filesChanged: 2 + index,
              testFilesChanged: index === 0 ? 2 : 1,
              changedFiles: [`app/wide-${index + 1}.ts`],
              bestValueFlags: {
                linesChanged: index === 0,
                filesChanged: index === 0,
                testFilesChanged: index === 0,
              },
            },
          },
          complianceAssessments: {
            create: [
              {
                principleKey: 'typescript-first-development',
                principleName: 'TypeScript-First Development',
                status: index === 0 ? 'pass' : 'mixed',
                notes: 'Wide fixture assessment.',
                displayOrder: 0,
              },
            ],
          },
        })),
      },
      decisionPoints: {
        create: [
          {
            title: 'Layout readiness',
            verdictTicketId: participants[0]!.id,
            verdictSummary: 'The winner remains readable at six columns.',
            rationale: 'Used for dashboard payload coverage.',
            participantApproaches: participants.map((ticket) => ({
              ticketId: ticket.id,
              ticketKey: ticket.ticketKey,
              summary: 'Scrollable comparison column',
            })),
            displayOrder: 0,
          },
        ],
      },
    },
  });

  return {
    sourceTicket,
    participants,
    comparison,
  };
}
