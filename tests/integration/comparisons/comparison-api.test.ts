/**
 * Integration Tests: Comparisons API
 *
 * Tests the workflow-ingested comparison storage and the ticket-scoped
 * comparison views that read from database-backed records.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext, createAPIClient, type APIClient } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const WORKFLOW_TOKEN = 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    includeTestUserHeader: false,
    enableTestAuthOverride: false,
    defaultHeaders: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('Comparisons API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();
  });

  async function createTicket(
    data: {
      title: string;
      description: string;
      branch: string;
      workflowType?: 'FULL' | 'QUICK' | 'CLEAN';
      agent?: 'CLAUDE' | 'CODEX';
    }
  ): Promise<{ id: number; ticketKey: string }> {
    const response = await ctx.api.post<{ id: number; ticketKey: string }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: data.title,
        description: data.description,
      }
    );

    await prisma.ticket.update({
      where: { id: response.data.id },
      data: {
        branch: data.branch,
        workflowType: data.workflowType ?? 'FULL',
        agent: data.agent ?? 'CLAUDE',
      },
    });

    return response.data;
  }

  describe('POST /api/projects/:projectId/comparisons', () => {
    it('stores a comparison and links it to every participating ticket', async () => {
      const sourceTicket = await createTicket({
        title: '[e2e] Source comparison ticket',
        description: 'source',
        branch: 'AIB-326-source-ticket',
        workflowType: 'FULL',
        agent: 'CODEX',
      });
      const variantA = await createTicket({
        title: '[e2e] Variant A',
        description: 'variant a',
        branch: 'AIB-327-variant-a',
        workflowType: 'QUICK',
      });
      const variantB = await createTicket({
        title: '[e2e] Variant B',
        description: 'variant b',
        branch: 'AIB-328-variant-b',
        workflowType: 'FULL',
      });

      await prisma.job.createMany({
        data: [
          {
            ticketId: sourceTicket.id,
            projectId: ctx.projectId,
            command: 'implement',
            status: 'COMPLETED',
            inputTokens: 1000,
            outputTokens: 400,
            costUsd: 0.11,
            durationMs: 120000,
            model: 'gpt-5.4',
            toolsUsed: ['Read', 'Edit'],
            updatedAt: new Date(),
          },
          {
            ticketId: variantA.id,
            projectId: ctx.projectId,
            command: 'verify',
            status: 'COMPLETED',
            inputTokens: 700,
            outputTokens: 250,
            costUsd: 0.07,
            durationMs: 90000,
            model: 'gpt-5.4-mini',
            toolsUsed: ['Read', 'Edit', 'Bash'],
            qualityScore: 88,
            qualityScoreDetails: JSON.stringify({
              dimensions: [],
              threshold: 'Excellent',
              computedAt: '2026-03-20T00:00:00Z',
            }),
            updatedAt: new Date(),
          },
        ],
      });

      const createResponse = await workflowApi.post<{
        id: number;
        filename: string;
      }>(`/api/projects/${ctx.projectId}/comparisons`, {
        sourceTicketId: sourceTicket.id,
        reportFilename: '20260320-120000-vs-AIB-327-AIB-328.md',
        reportPath: `specs/${sourceTicket.ticketKey.toLowerCase()}/comparisons/20260320-120000-vs-AIB-327-AIB-328.md`,
        generatedAt: '2026-03-20T12:00:00.000Z',
        recommendation: 'Ship AIB-327 because it balances quality and delivery speed.',
        winnerTicketId: variantA.id,
        summary: 'Variant A wins on cleaner state handling and stronger tests.',
        decisionPoints: [
          {
            title: 'Server state management',
            verdict: 'AIB-327 is the most maintainable approach.',
            winningTicketId: variantA.id,
            approaches: [
              {
                ticketId: sourceTicket.id,
                approach: 'Custom polling state',
                rationale: 'Works, but duplicates fetch lifecycle handling.',
              },
              {
                ticketId: variantA.id,
                approach: 'TanStack Query',
                rationale: 'Matches project conventions and reduces boilerplate.',
              },
              {
                ticketId: variantB.id,
                approach: 'Mixed local state and effects',
                rationale: 'Harder to reason about and less reusable.',
              },
            ],
          },
        ],
        tickets: [
          {
            ticketId: sourceTicket.id,
            rank: 2,
            score: 84,
            verdictSummary: 'Solid baseline, but more custom state management.',
            keyDifferentiators: ['Readable code', 'Lower test ratio'],
            metrics: {
              linesAdded: 120,
              linesRemoved: 35,
              sourceFiles: 5,
              testFiles: 1,
              testRatio: 0.2,
            },
            constitution: {
              overall: 80,
              principles: [
                {
                  principle: 'TypeScript-First Development',
                  status: 'pass',
                  summary: 'No unsafe casts found.',
                },
              ],
            },
          },
          {
            ticketId: variantA.id,
            rank: 1,
            score: 91,
            verdictSummary: 'Best use of existing data-fetching and testing patterns.',
            keyDifferentiators: ['Strong test coverage', 'Constitution-aligned state management'],
            metrics: {
              linesAdded: 140,
              linesRemoved: 42,
              sourceFiles: 6,
              testFiles: 3,
              testRatio: 0.5,
            },
            constitution: {
              overall: 93,
              principles: [
                {
                  principle: 'Component-Driven Architecture',
                  status: 'pass',
                  summary: 'Uses existing component and query patterns.',
                },
              ],
            },
          },
          {
            ticketId: variantB.id,
            rank: 3,
            score: 70,
            verdictSummary: 'Functional, but heavier and less consistent.',
            keyDifferentiators: ['Broader scope', 'Needs tighter tests'],
            metrics: {
              linesAdded: 180,
              linesRemoved: 60,
              sourceFiles: 8,
              testFiles: 1,
              testRatio: 0.125,
            },
            constitution: {
              overall: 68,
              principles: [
                {
                  principle: 'Test-Driven Development',
                  status: 'warning',
                  summary: 'Coverage exists, but important edge cases are missing.',
                },
              ],
            },
          },
        ],
      });

      expect(createResponse.status).toBe(201);
      expect(createResponse.data.filename).toBe('20260320-120000-vs-AIB-327-AIB-328.md');

      const sourceListResponse = await ctx.api.get<{
        comparisons: Array<{ filename: string; comparedTickets: string[] }>;
        total: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/comparisons`);

      expect(sourceListResponse.status).toBe(200);
      expect(sourceListResponse.data.total).toBe(1);
      expect(sourceListResponse.data.comparisons[0]?.comparedTickets).toEqual([
        variantA.ticketKey,
        variantB.ticketKey,
      ]);

      const comparedListResponse = await ctx.api.get<{
        comparisons: Array<{ sourceTicket: string; comparedTickets: string[] }>;
        total: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${variantA.id}/comparisons`);

      expect(comparedListResponse.status).toBe(200);
      expect(comparedListResponse.data.total).toBe(1);
      expect(comparedListResponse.data.comparisons[0]?.sourceTicket).toBe(sourceTicket.ticketKey);
      expect(comparedListResponse.data.comparisons[0]?.comparedTickets).toEqual([
        sourceTicket.ticketKey,
        variantB.ticketKey,
      ]);

      const checkResponse = await ctx.api.get<{
        hasComparisons: boolean;
        count: number;
        latestReport: string | null;
      }>(`/api/projects/${ctx.projectId}/tickets/${variantB.id}/comparisons/check`);

      expect(checkResponse.status).toBe(200);
      expect(checkResponse.data).toEqual({
        hasComparisons: true,
        count: 1,
        latestReport: '20260320-120000-vs-AIB-327-AIB-328.md',
      });
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id/comparisons/:filename', () => {
    it('returns a structured comparison view enriched with ticket metadata, telemetry, and quality scores', async () => {
      const sourceTicket = await createTicket({
        title: '[e2e] Comparison source',
        description: 'source',
        branch: 'AIB-400-comparison-source',
        workflowType: 'FULL',
        agent: 'CODEX',
      });
      const variantTicket = await createTicket({
        title: '[e2e] Comparison variant',
        description: 'variant',
        branch: 'AIB-401-comparison-variant',
        workflowType: 'QUICK',
        agent: 'CLAUDE',
      });

      await prisma.job.createMany({
        data: [
          {
            ticketId: sourceTicket.id,
            projectId: ctx.projectId,
            command: 'implement',
            status: 'COMPLETED',
            inputTokens: 1200,
            outputTokens: 300,
            costUsd: 0.09,
            durationMs: 100000,
            model: 'gpt-5.4',
            toolsUsed: ['Read', 'Edit'],
            updatedAt: new Date(),
          },
          {
            ticketId: variantTicket.id,
            projectId: ctx.projectId,
            command: 'verify',
            status: 'COMPLETED',
            inputTokens: 800,
            outputTokens: 200,
            costUsd: 0.06,
            durationMs: 85000,
            model: 'gpt-5.4-mini',
            toolsUsed: ['Read', 'Bash'],
            qualityScore: 90,
            qualityScoreDetails: JSON.stringify({
              dimensions: [],
              threshold: 'Excellent',
              computedAt: '2026-03-20T00:00:00Z',
            }),
            updatedAt: new Date(),
          },
        ],
      });

      await workflowApi.post(`/api/projects/${ctx.projectId}/comparisons`, {
        sourceTicketId: sourceTicket.id,
        reportFilename: '20260320-130000-vs-AIB-401.md',
        reportPath: 'specs/AIB-400-comparison-source/comparisons/20260320-130000-vs-AIB-401.md',
        generatedAt: '2026-03-20T13:00:00.000Z',
        recommendation: 'Ship AIB-401.',
        winnerTicketId: variantTicket.id,
        summary: 'AIB-401 is the strongest overall implementation.',
        decisionPoints: [
          {
            title: 'Data fetching',
            verdict: 'AIB-401 aligns best with existing patterns.',
            winningTicketId: variantTicket.id,
            approaches: [
              {
                ticketId: sourceTicket.id,
                approach: 'Manual fetch lifecycle',
                rationale: 'More code to maintain.',
              },
              {
                ticketId: variantTicket.id,
                approach: 'TanStack Query',
                rationale: 'Matches current app architecture.',
              },
            ],
          },
        ],
        tickets: [
          {
            ticketId: sourceTicket.id,
            rank: 2,
            score: 82,
            verdictSummary: 'Good implementation, but not the cleanest.',
            keyDifferentiators: ['Lower code churn'],
            metrics: {
              linesAdded: 100,
              linesRemoved: 20,
              sourceFiles: 4,
              testFiles: 1,
              testRatio: 0.25,
            },
            constitution: {
              overall: 81,
              principles: [
                {
                  principle: 'Security-First Design',
                  status: 'pass',
                  summary: 'No unsafe API surface introduced.',
                },
              ],
            },
          },
          {
            ticketId: variantTicket.id,
            rank: 1,
            score: 90,
            verdictSummary: 'Best mix of maintainability and coverage.',
            keyDifferentiators: ['Higher quality score', 'Better test ratio'],
            metrics: {
              linesAdded: 115,
              linesRemoved: 30,
              sourceFiles: 5,
              testFiles: 2,
              testRatio: 0.4,
            },
            constitution: {
              overall: 94,
              principles: [
                {
                  principle: 'Test-Driven Development',
                  status: 'pass',
                  summary: 'Strong coverage around the main user flow.',
                },
              ],
            },
          },
        ],
      });

      const response = await ctx.api.get<{
        comparison: {
          filename: string;
          recommendation: string;
          winnerTicket: { id: number; ticketKey: string } | null;
          tickets: Array<{
            ticketId: number;
            ticketKey: string;
            workflowType: string;
            agent: string | null;
            rank: number;
            score: number;
            telemetry: { costUsd: number; hasData: boolean };
            qualityScore: { score: number | null; threshold: string | null };
            metrics: { testRatio: number };
          }>;
          decisionPoints: Array<{
            title: string;
            winningTicketId: number | null;
          }>;
        };
      }>(
        `/api/projects/${ctx.projectId}/tickets/${variantTicket.id}/comparisons/20260320-130000-vs-AIB-401.md`
      );

      expect(response.status).toBe(200);
      expect(response.data.comparison.filename).toBe('20260320-130000-vs-AIB-401.md');
      expect(response.data.comparison.recommendation).toBe('Ship AIB-401.');
      expect(response.data.comparison.winnerTicket?.ticketKey).toBe(variantTicket.ticketKey);
      expect(response.data.comparison.decisionPoints).toEqual([
        expect.objectContaining({
          title: 'Data fetching',
          winningTicketId: variantTicket.id,
        }),
      ]);

      expect(response.data.comparison.tickets).toHaveLength(2);
      expect(response.data.comparison.tickets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ticketId: sourceTicket.id,
            ticketKey: sourceTicket.ticketKey,
            workflowType: 'FULL',
            agent: 'CODEX',
            rank: 2,
            score: 82,
            telemetry: expect.objectContaining({
              costUsd: 0.09,
              hasData: true,
            }),
            qualityScore: {
              score: null,
              threshold: null,
            },
            metrics: expect.objectContaining({
              testRatio: 0.25,
            }),
          }),
          expect.objectContaining({
            ticketId: variantTicket.id,
            ticketKey: variantTicket.ticketKey,
            workflowType: 'QUICK',
            agent: 'CLAUDE',
            rank: 1,
            score: 90,
            telemetry: expect.objectContaining({
              costUsd: 0.06,
              hasData: true,
            }),
            qualityScore: {
              score: 90,
              threshold: 'Excellent',
            },
            metrics: expect.objectContaining({
              testRatio: 0.4,
            }),
          }),
        ])
      );
    });

    it('returns 400 for invalid filename format', async () => {
      const ticket = await createTicket({
        title: '[e2e] Ticket without comparison',
        description: 'invalid filename coverage',
        branch: 'AIB-450-invalid-name',
      });

      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticket.id}/comparisons/not-a-valid-report-name.md`
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });
  });
});
