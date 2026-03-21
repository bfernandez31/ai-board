import { JobStatus, WorkflowType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildComparisonOperationalData } from '@/lib/comparison/comparison-operational-metrics';

function createJob(overrides: Partial<Parameters<typeof buildComparisonOperationalData>[0][number]['jobs'][number]>) {
  return {
    ticketId: 1,
    status: JobStatus.COMPLETED,
    command: 'implement',
    inputTokens: null,
    outputTokens: null,
    durationMs: null,
    costUsd: null,
    model: null,
    qualityScore: null,
    qualityScoreDetails: null,
    startedAt: new Date('2026-03-20T10:00:00.000Z'),
    completedAt: new Date('2026-03-20T10:01:00.000Z'),
    ...overrides,
  };
}

describe('buildComparisonOperationalData', () => {
  it('aggregates totals, preserves best-value ties, and distinguishes pending and unavailable states', () => {
    const results = buildComparisonOperationalData([
      {
        ticketId: 1,
        ticketKey: 'AIB-1',
        workflowType: WorkflowType.FULL,
        jobs: [
          createJob({
            ticketId: 1,
            inputTokens: 100,
            outputTokens: 100,
            durationMs: 1000,
            costUsd: 0.02,
            model: 'gpt-5.4',
            command: 'verify',
            qualityScore: 91,
            qualityScoreDetails: JSON.stringify({
              threshold: 'Excellent',
              computedAt: '2026-03-20T10:01:00.000Z',
              dimensions: [
                { agentId: 'compliance', name: 'Compliance', score: 95, weight: 0.4, weightedScore: 38 },
              ],
            }),
          }),
        ],
      },
      {
        ticketId: 2,
        ticketKey: 'AIB-2',
        workflowType: WorkflowType.QUICK,
        jobs: [
          createJob({
            ticketId: 2,
            inputTokens: 50,
            outputTokens: 50,
            durationMs: 1000,
            costUsd: 0.02,
            model: 'gpt-4.1',
          }),
          createJob({
            ticketId: 2,
            command: 'verify',
            inputTokens: 50,
            outputTokens: 50,
            durationMs: 1000,
            costUsd: 0.02,
            model: 'claude-3.7',
            qualityScore: 75,
            qualityScoreDetails: JSON.stringify({
              threshold: 'Good',
              computedAt: '2026-03-20T10:01:00.000Z',
              dimensions: [
                { agentId: 'compliance', name: 'Compliance', score: 75, weight: 0.4, weightedScore: 30 },
              ],
            }),
          }),
        ],
      },
      {
        ticketId: 3,
        ticketKey: 'AIB-3',
        workflowType: WorkflowType.FULL,
        jobs: [
          createJob({
            ticketId: 3,
            status: JobStatus.RUNNING,
            completedAt: null,
          }),
        ],
      },
      {
        ticketId: 4,
        ticketKey: 'AIB-4',
        workflowType: WorkflowType.FULL,
        jobs: [],
      },
    ]);

    expect(results.get(1)?.operational.totalTokens.value).toBe(200);
    expect(results.get(1)?.operational.totalTokens.isBest).toBe(true);
    expect(results.get(2)?.operational.totalTokens.isBest).toBe(true);
    expect(results.get(3)?.operational.totalTokens.state).toBe('pending');
    expect(results.get(4)?.operational.totalTokens.state).toBe('unavailable');
    expect(results.get(2)?.operational.model.label).toBe('Multiple models');
    expect(results.get(2)?.operational.model.mixedModels).toBe(true);
    expect(results.get(1)?.quality.detailsState).toBe('available');
    expect(results.get(2)?.quality.detailsState).toBe('summary_only');
    expect(results.get(1)?.quality.isBest).toBe(true);
  });
});
