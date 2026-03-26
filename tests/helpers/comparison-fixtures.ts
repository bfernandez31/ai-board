import { getPrismaClient } from './db-cleanup';
import { createTestTicket } from './db-setup';
import { createComparisonReport, generateReportPath } from '@/lib/comparison/comparison-generator';
import {
  createCompareRunKey,
  createComparisonPersistenceRequest,
} from '@/lib/comparison/comparison-payload';

type StructuredFixtureOptions = {
  participantCount?: 2 | 4 | 6;
  pendingTelemetryTicketIndexes?: number[];
  missingComplianceTicketIndexes?: number[];
  unavailableMetricTicketIndexes?: number[];
};

const DEFAULT_OPTIONS: Required<StructuredFixtureOptions> = {
  participantCount: 2,
  pendingTelemetryTicketIndexes: [],
  missingComplianceTicketIndexes: [],
  unavailableMetricTicketIndexes: [],
};

function buildParticipantKeys(participantCount: number): string[] {
  return Array.from({ length: participantCount }, (_, index) => `TE2-${102 + index}`);
}

export async function createStructuredComparisonFixture(
  projectId: number,
  options: StructuredFixtureOptions = {}
) {
  const prisma = getPrismaClient();
  const resolved = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const sourceTicket = await createTestTicket(projectId, {
    title: '[e2e] Source ticket',
    description: 'Source comparison ticket',
    ticketNumber: 101,
    ticketKey: 'TE2-101',
    stage: 'BUILD',
  });

  const participantKeys = buildParticipantKeys(resolved.participantCount);
  const stageCycle = ['VERIFY', 'PLAN', 'BUILD', 'SPECIFY', 'VERIFY', 'PLAN'] as const;
  const participantTickets = await Promise.all(
    participantKeys.map((ticketKey, index) =>
      createTestTicket(projectId, {
        title: `[e2e] Participant ${index + 1}`,
        description: `Comparison ticket ${ticketKey}`,
        ticketNumber: 102 + index,
        ticketKey,
        stage: stageCycle[index] ?? 'PLAN',
      })
    )
  );

  const winnerTicket = participantTickets[0]!;
  const otherTicket = participantTickets[1] ?? participantTickets[0]!;

  await prisma.job.createMany({
    data: participantTickets.flatMap((ticket, index) => {
      if (resolved.pendingTelemetryTicketIndexes.includes(index)) {
        return [
          {
            ticketId: ticket.id,
            projectId,
            command: 'verify',
            status: 'RUNNING' as const,
            qualityScore: null,
            inputTokens: null,
            outputTokens: null,
            costUsd: null,
            durationMs: null,
            startedAt: new Date(`2026-03-19T1${index}:00:00.000Z`),
            updatedAt: new Date(`2026-03-19T1${index}:02:00.000Z`),
          },
        ];
      }

      return [
        {
          ticketId: ticket.id,
          projectId,
          command: 'verify',
          status: 'COMPLETED' as const,
          qualityScore: Math.max(58, 91 - index * 7),
          inputTokens: 1200 + index * 350,
          outputTokens: 400 + index * 100,
          costUsd: 0.08 + index * 0.03,
          durationMs: 120000 + index * 45000,
          startedAt: new Date(`2026-03-19T0${index}:00:00.000Z`),
          completedAt: new Date(`2026-03-19T0${index}:02:00.000Z`),
          updatedAt: new Date(`2026-03-19T0${index}:02:00.000Z`),
        },
      ];
    }),
  });

  const comparison = await prisma.comparisonRecord.create({
    data: {
      projectId,
      sourceTicketId: sourceTicket.id,
      winnerTicketId: winnerTicket.id,
      compareRunKey: `cmp_fixture_${resolved.participantCount}_${sourceTicket.ticketKey.toLowerCase()}`,
      markdownPath: `specs/${sourceTicket.ticketKey}/comparisons/example.md`,
      summary: 'Winner ticket had the best test coverage and smallest diff.',
      overallRecommendation: `Choose ${winnerTicket.ticketKey} for the implementation baseline.`,
      keyDifferentiators: ['coverage', 'smaller diff', 'stable dashboard'],
      generatedAt: new Date('2026-03-20T09:00:00.000Z'),
      participants: {
        create: participantTickets.map((ticket, index) => ({
          ticketId: ticket.id,
          rank: index + 1,
          score: Math.max(58, 91 - index * 8),
          workflowTypeAtComparison: index % 3 === 0 ? 'FULL' : index % 3 === 1 ? 'QUICK' : 'CLEAN',
          rankRationale:
            index === 0
              ? 'Strong verify results and concise implementation.'
              : index === 1
                ? 'Good direction but less complete test coverage.'
                : `Participant ${index + 1} required more trade-offs to finish.`,
          metricSnapshot: {
            create: {
              linesAdded: resolved.unavailableMetricTicketIndexes.includes(index) ? null : 20 + index * 18,
              linesRemoved: resolved.unavailableMetricTicketIndexes.includes(index) ? null : 5 + index * 6,
              linesChanged: resolved.unavailableMetricTicketIndexes.includes(index) ? null : 25 + index * 24,
              filesChanged: resolved.unavailableMetricTicketIndexes.includes(index) ? null : 3 + index,
              testFilesChanged: resolved.unavailableMetricTicketIndexes.includes(index)
                ? null
                : Math.max(0, 2 - Math.floor(index / 2)),
              changedFiles: resolved.unavailableMetricTicketIndexes.includes(index)
                ? []
                : [`app/${ticket.ticketKey.toLowerCase()}.ts`, `tests/${ticket.ticketKey.toLowerCase()}.test.ts`],
              bestValueFlags: {
                linesChanged: index === 0,
                filesChanged: index === 0,
                testFilesChanged: index === 0,
              },
            },
          },
          complianceAssessments: resolved.missingComplianceTicketIndexes.includes(index)
            ? undefined
            : {
                create: [
                  {
                    principleKey: 'typescript-first-development',
                    principleName: 'TypeScript-First Development',
                    status: index === 0 ? 'pass' : index === 1 ? 'mixed' : 'fail',
                    notes:
                      index === 0
                        ? 'Strict types retained.'
                        : index === 1
                          ? 'Some typing gaps remain.'
                          : 'Missing strict types in key workflow paths.',
                    displayOrder: 0,
                  },
                ],
              },
        })),
      },
      decisionPoints: {
        create: [
          {
            title: 'State handling',
            verdictTicketId: winnerTicket.id,
            verdictSummary: `${winnerTicket.ticketKey} handled pending states cleanly.`,
            rationale: 'The winner kept unavailable telemetry explicit.',
            participantApproaches: participantTickets.map((ticket, index) => ({
              ticketId: ticket.id,
              ticketKey: ticket.ticketKey,
              summary:
                index === 0
                  ? 'Used explicit pending and unavailable states.'
                  : `Participant ${index + 1} used a less explicit fallback strategy.`,
            })),
            displayOrder: 0,
          },
          {
            title: 'Fallback behavior',
            verdictTicketId: otherTicket.id,
            verdictSummary: `${otherTicket.ticketKey} kept legacy rows readable without extra synthesis.`,
            rationale: 'The follow-up implementation guarded sparse historical payloads.',
            participantApproaches: participantTickets.map((ticket, index) => ({
              ticketId: ticket.id,
              ticketKey: ticket.ticketKey,
              summary:
                index === 1
                  ? 'Handled partial saved rows without crashing the detail view.'
                  : `Participant ${index + 1} prioritized a different fallback shape.`,
            })),
            displayOrder: 1,
          },
        ],
      },
    },
  });

  return {
    sourceTicket,
    winnerTicket,
    otherTicket,
    participantTickets,
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
    `Choose ${comparedTickets[0]}.`,
    [
      {
        title: 'Persistence source of truth',
        verdictTicketKey: comparedTickets[0] ?? null,
        verdictSummary: `${comparedTickets[0]} persists structured decision points directly.`,
        rationale: 'It keeps saved decision points aligned with the generated comparison output.',
        participantApproaches: comparedTickets.map((ticketKey, index) => ({
          ticketKey,
          summary:
            index === 0
              ? 'Maps structured decision points directly into saved rows.'
              : 'Relies more on report-level summary fields.',
        })),
      },
      {
        title: 'Historical comparison compatibility',
        verdictTicketKey: null,
        verdictSummary: 'Historical rows stay readable even when structured data is sparse.',
        rationale: 'The route should preserve saved comparisons with partial structured fields.',
        participantApproaches: comparedTickets.map((ticketKey) => ({
          ticketKey,
          summary: 'Keeps fallback rendering stable for older saved comparisons.',
        })),
      },
    ],
    []
  );
}

export function createComparisonPersistenceFixture(
  projectId: number,
  sourceTicketKey: string,
  comparedTickets: string[],
  branch: string = sourceTicketKey
) {
  const report = createWorkflowComparisonReportFixture(sourceTicketKey, comparedTickets);
  const generatedAt = report.metadata.generatedAt;
  const compareRunKey = createCompareRunKey(sourceTicketKey, comparedTickets, generatedAt);
  const markdownPath = generateReportPath(
    branch,
    `${generatedAt.toISOString().replace(/[:.]/g, '-')}-vs-${comparedTickets.join('-')}.md`
  );
  const persistedReport = {
    ...report,
    metadata: {
      ...report.metadata,
      filePath: markdownPath,
    },
  };

  return createComparisonPersistenceRequest({
    compareRunKey,
    projectId,
    sourceTicketKey,
    participantTicketKeys: comparedTickets,
    markdownPath,
    report: persistedReport,
  });
}

type WorkflowComparisonPayloadFixtureInput = {
  projectId: number;
  branch: string;
  sourceTicket: {
    id?: number;
    ticketKey: string;
  };
  participants: Array<{
    id?: number;
    ticketKey: string;
  }>;
};

export function createWorkflowComparisonPayloadFixture(
  input: WorkflowComparisonPayloadFixtureInput
) {
  return createComparisonPersistenceFixture(
    input.projectId,
    input.sourceTicket.ticketKey,
    input.participants.map((participant) => participant.ticketKey)
    ,
    input.branch
  );
}
