import { describe, it, expect } from 'vitest';
import { aggregateCostByStage, aggregateToolUsage } from '@/lib/analytics/aggregations';
import { COMMAND_TO_STAGE } from '@/lib/analytics/types';

describe('aggregateCostByStage', () => {
  it('aggregates cost by stage correctly', () => {
    const jobs = [
      { command: 'specify', costUsd: 10.5 },
      { command: 'plan', costUsd: 15.0 },
      { command: 'implement', costUsd: 25.0 },
      { command: 'verify', costUsd: 5.0 },
      { command: 'comment-specify', costUsd: 2.0 },
    ];

    const result = aggregateCostByStage(jobs);

    expect(result).toHaveLength(4);
    expect(result.find(s => s.stage === 'SPECIFY')).toEqual({
      stage: 'SPECIFY',
      costUsd: 12.5,
      jobCount: 2,
      percentage: expect.any(Number),
    });
    expect(result.find(s => s.stage === 'BUILD')).toEqual({
      stage: 'BUILD',
      costUsd: 25.0,
      jobCount: 1,
      percentage: expect.any(Number),
    });
  });

  it('handles empty job list', () => {
    const result = aggregateCostByStage([]);
    expect(result).toEqual([]);
  });

  it('skips jobs with unknown commands', () => {
    const jobs = [
      { command: 'specify', costUsd: 10.0 },
      { command: 'unknown-command', costUsd: 5.0 },
    ];

    const result = aggregateCostByStage(jobs);
    expect(result).toHaveLength(1);
    expect(result[0].stage).toBe('SPECIFY');
  });

  it('sorts stages by cost descending', () => {
    const jobs = [
      { command: 'specify', costUsd: 5.0 },
      { command: 'implement', costUsd: 50.0 },
      { command: 'plan', costUsd: 10.0 },
    ];

    const result = aggregateCostByStage(jobs);
    expect(result[0].stage).toBe('BUILD'); // highest cost
    expect(result[1].stage).toBe('PLAN');
    expect(result[2].stage).toBe('SPECIFY');
  });
});

describe('aggregateToolUsage', () => {
  it('aggregates tool usage correctly', () => {
    const jobs = [
      { toolsUsed: ['Read', 'Edit', 'Bash'] },
      { toolsUsed: ['Read', 'Edit'] },
      { toolsUsed: ['Read', 'Grep'] },
    ];

    const result = aggregateToolUsage(jobs);

    expect(result.find(t => t.toolName === 'Read')).toEqual({
      toolName: 'Read',
      usageCount: 3,
      percentage: expect.any(Number),
    });
    expect(result.find(t => t.toolName === 'Edit')).toEqual({
      toolName: 'Edit',
      usageCount: 2,
      percentage: expect.any(Number),
    });
  });

  it('limits to top 10 tools', () => {
    const jobs = Array.from({ length: 15 }, (_, i) => ({
      toolsUsed: [`Tool${i}`],
    }));

    const result = aggregateToolUsage(jobs);
    expect(result).toHaveLength(10);
  });

  it('sorts tools by usage count descending', () => {
    const jobs = [
      { toolsUsed: ['A', 'A', 'A'] },
      { toolsUsed: ['B'] },
      { toolsUsed: ['C', 'C'] },
    ];

    const result = aggregateToolUsage(jobs);
    expect(result[0].toolName).toBe('A'); // most used
    expect(result[1].toolName).toBe('C');
    expect(result[2].toolName).toBe('B');
  });

  it('handles empty tools arrays', () => {
    const jobs = [
      { toolsUsed: [] },
      { toolsUsed: ['Read'] },
    ];

    const result = aggregateToolUsage(jobs);
    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('Read');
  });
});
