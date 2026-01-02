/**
 * Unit Tests: Feature Alignment Scoring
 *
 * Tests the feature alignment calculation for comparing ticket specifications.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAlignment,
  calculateDimensionScore,
  findMatchingRequirements,
  findMatchingEntities,
  ALIGNMENT_WEIGHTS,
  ALIGNMENT_THRESHOLD,
} from '@/lib/comparison/feature-alignment';
import type { SpecSections } from '@/lib/types/comparison';

describe('ALIGNMENT_WEIGHTS', () => {
  it('should have weights that sum to 1', () => {
    const total =
      ALIGNMENT_WEIGHTS.requirements +
      ALIGNMENT_WEIGHTS.scenarios +
      ALIGNMENT_WEIGHTS.entities +
      ALIGNMENT_WEIGHTS.keywords;
    expect(total).toBeCloseTo(1, 10);
  });

  it('should have requirements as highest weight', () => {
    expect(ALIGNMENT_WEIGHTS.requirements).toBe(0.4);
    expect(ALIGNMENT_WEIGHTS.requirements).toBeGreaterThan(
      ALIGNMENT_WEIGHTS.scenarios
    );
  });
});

describe('ALIGNMENT_THRESHOLD', () => {
  it('should be 30%', () => {
    expect(ALIGNMENT_THRESHOLD).toBe(30);
  });
});

describe('calculateDimensionScore', () => {
  it('should return 100 for identical arrays', () => {
    const arr = ['a', 'b', 'c'];
    expect(calculateDimensionScore(arr, arr)).toBe(100);
  });

  it('should return 0 for completely different arrays', () => {
    expect(calculateDimensionScore(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('should return 100 for two empty arrays', () => {
    expect(calculateDimensionScore([], [])).toBe(100);
  });

  it('should return 0 when one array is empty', () => {
    expect(calculateDimensionScore(['a'], [])).toBe(0);
    expect(calculateDimensionScore([], ['a'])).toBe(0);
  });

  it('should calculate partial overlap correctly', () => {
    // intersection: {b, c} = 2, union: {a, b, c, d} = 4
    // jaccard = 0.5 → 50%
    const score = calculateDimensionScore(['a', 'b', 'c'], ['b', 'c', 'd']);
    expect(score).toBe(50);
  });
});

describe('findMatchingRequirements', () => {
  it('should find exact matching requirements', () => {
    const reqs1 = ['FR-001', 'FR-002', 'FR-003'];
    const reqs2 = ['FR-002', 'FR-003', 'FR-004'];
    const matches = findMatchingRequirements(reqs1, reqs2);
    expect(matches).toContain('FR-002');
    expect(matches).toContain('FR-003');
    expect(matches).not.toContain('FR-001');
    expect(matches).not.toContain('FR-004');
  });

  it('should return empty array for no matches', () => {
    const matches = findMatchingRequirements(['FR-001'], ['FR-002']);
    expect(matches).toEqual([]);
  });

  it('should handle empty arrays', () => {
    expect(findMatchingRequirements([], ['FR-001'])).toEqual([]);
    expect(findMatchingRequirements(['FR-001'], [])).toEqual([]);
    expect(findMatchingRequirements([], [])).toEqual([]);
  });
});

describe('findMatchingEntities', () => {
  it('should find exact matching entities', () => {
    const entities1 = ['User', 'Ticket', 'Project'];
    const entities2 = ['Ticket', 'Comment', 'Project'];
    const matches = findMatchingEntities(entities1, entities2);
    expect(matches).toContain('Ticket');
    expect(matches).toContain('Project');
    expect(matches).not.toContain('User');
    expect(matches).not.toContain('Comment');
  });

  it('should be case-sensitive', () => {
    const matches = findMatchingEntities(['User'], ['user']);
    expect(matches).toEqual([]);
  });

  it('should handle empty arrays', () => {
    expect(findMatchingEntities([], [])).toEqual([]);
  });
});

describe('calculateAlignment', () => {
  const createSpecSections = (
    requirements: string[],
    scenarios: string[],
    entities: string[],
    keywords: string[]
  ): SpecSections => ({
    requirements,
    scenarios,
    entities,
    keywords,
    rawSections: {},
  });

  it('should return 100% alignment for identical specs', () => {
    const spec = createSpecSections(
      ['FR-001', 'FR-002'],
      ['US1', 'US2'],
      ['User', 'Ticket'],
      ['compare', 'feature']
    );

    const result = calculateAlignment(spec, spec);
    expect(result.overall).toBe(100);
    expect(result.isAligned).toBe(true);
  });

  it('should return 0% for completely different specs', () => {
    const spec1 = createSpecSections(
      ['FR-001'],
      ['US1'],
      ['UserA'],
      ['keyword1']
    );
    const spec2 = createSpecSections(
      ['FR-999'],
      ['US9'],
      ['UserZ'],
      ['keyword9']
    );

    const result = calculateAlignment(spec1, spec2);
    expect(result.overall).toBe(0);
    expect(result.isAligned).toBe(false);
  });

  it('should calculate weighted average correctly', () => {
    // Create specs with 50% overlap in all dimensions
    const spec1 = createSpecSections(
      ['FR-001', 'FR-002'],
      ['US1', 'US2'],
      ['Entity1', 'Entity2'],
      ['key1', 'key2']
    );
    const spec2 = createSpecSections(
      ['FR-002', 'FR-003'],
      ['US2', 'US3'],
      ['Entity2', 'Entity3'],
      ['key2', 'key3']
    );

    const result = calculateAlignment(spec1, spec2);
    // All dimensions have 50% overlap (jaccard = 0.33), so overall ~33%
    expect(result.overall).toBeGreaterThan(30);
    expect(result.overall).toBeLessThan(40);
  });

  it('should respect alignment threshold', () => {
    const spec1 = createSpecSections(['FR-001'], [], [], []);
    const spec2 = createSpecSections(['FR-002'], [], [], []);

    const result = calculateAlignment(spec1, spec2);
    expect(result.isAligned).toBe(result.overall >= ALIGNMENT_THRESHOLD);
  });

  it('should track matching requirements', () => {
    const spec1 = createSpecSections(
      ['FR-001', 'FR-002', 'FR-003'],
      [],
      [],
      []
    );
    const spec2 = createSpecSections(['FR-002', 'FR-003', 'FR-004'], [], [], []);

    const result = calculateAlignment(spec1, spec2);
    expect(result.matchingRequirements).toContain('FR-002');
    expect(result.matchingRequirements).toContain('FR-003');
    expect(result.matchingRequirements).toHaveLength(2);
  });

  it('should track matching entities', () => {
    const spec1 = createSpecSections([], [], ['User', 'Ticket'], []);
    const spec2 = createSpecSections([], [], ['Ticket', 'Comment'], []);

    const result = calculateAlignment(spec1, spec2);
    expect(result.matchingEntities).toContain('Ticket');
    expect(result.matchingEntities).toHaveLength(1);
  });

  it('should include all dimension scores', () => {
    const spec1 = createSpecSections(
      ['FR-001'],
      ['US1'],
      ['Entity'],
      ['keyword']
    );
    const spec2 = createSpecSections(
      ['FR-001'],
      ['US2'],
      ['Entity'],
      ['other']
    );

    const result = calculateAlignment(spec1, spec2);
    expect(result.dimensions.requirements).toBe(100);
    expect(result.dimensions.scenarios).toBe(0);
    expect(result.dimensions.entities).toBe(100);
    expect(result.dimensions.keywords).toBe(0);
  });

  it('should handle empty specs gracefully', () => {
    const emptySpec = createSpecSections([], [], [], []);
    const result = calculateAlignment(emptySpec, emptySpec);
    expect(result.overall).toBe(100);
    expect(result.isAligned).toBe(true);
  });

  it('should handle one empty spec', () => {
    const spec = createSpecSections(
      ['FR-001'],
      ['US1'],
      ['Entity'],
      ['keyword']
    );
    const emptySpec = createSpecSections([], [], [], []);

    const result = calculateAlignment(spec, emptySpec);
    expect(result.overall).toBe(0);
    expect(result.isAligned).toBe(false);
  });

  it('should round overall score to integer', () => {
    const spec1 = createSpecSections(['FR-001', 'FR-002', 'FR-003'], [], [], []);
    const spec2 = createSpecSections(['FR-003', 'FR-004', 'FR-005'], [], [], []);

    const result = calculateAlignment(spec1, spec2);
    expect(Number.isInteger(result.overall)).toBe(true);
  });
});
