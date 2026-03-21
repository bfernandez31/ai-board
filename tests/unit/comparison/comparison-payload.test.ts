import { describe, expect, it } from 'vitest';
import {
  createCompareRunKey,
  createComparisonPersistenceRequest,
  getComparisonDataArtifactPath,
  normalizeComparisonPersistenceRequest,
  serializeComparisonReport,
} from '@/lib/comparison/comparison-payload';
import { createComparisonReport } from '@/lib/comparison/comparison-generator';

describe('comparison-payload helpers', () => {
  const report = createComparisonReport(
    'AIB-330',
    ['AIB-325', 'AIB-327'],
    {
      overall: 86,
      dimensions: {
        requirements: 90,
        scenarios: 80,
        entities: 85,
        keywords: 75,
      },
      isAligned: true,
      matchingRequirements: ['FR-001'],
      matchingEntities: ['ComparisonRecord'],
    },
    {
      'AIB-325': {
        ticketKey: 'AIB-325',
        linesAdded: 20,
        linesRemoved: 4,
        linesChanged: 24,
        filesChanged: 3,
        changedFiles: ['lib/comparison/comparison-record.ts'],
        testFilesChanged: 1,
        hasData: true,
      },
      'AIB-327': {
        ticketKey: 'AIB-327',
        linesAdded: 18,
        linesRemoved: 3,
        linesChanged: 21,
        filesChanged: 2,
        changedFiles: ['app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts'],
        testFilesChanged: 1,
        hasData: true,
      },
    },
    {
      'AIB-325': {
        overall: 92,
        totalPrinciples: 1,
        passedPrinciples: 1,
        principles: [
          {
            name: 'TypeScript-First Development',
            section: 'I',
            passed: true,
            notes: 'Explicit typed route schema',
          },
        ],
      },
      'AIB-327': {
        overall: 65,
        totalPrinciples: 1,
        passedPrinciples: 0,
        principles: [
          {
            name: 'TypeScript-First Development',
            section: 'I',
            passed: false,
            notes: 'One typing gap remains',
          },
        ],
      },
    },
    {},
    'Ship AIB-325.'
  );

  it('serializes and normalizes a comparison persistence payload', () => {
    const compareRunKey = createCompareRunKey(
      'AIB-330',
      ['AIB-325', 'AIB-327'],
      report.metadata.generatedAt
    );

    const payload = createComparisonPersistenceRequest({
      compareRunKey,
      projectId: 3,
      sourceTicketId: 330,
      sourceTicketKey: 'AIB-330',
      participantTicketIds: [325, 327],
      markdownPath: 'specs/AIB-330-persist-comparison-data/comparisons/20260321-133600-vs-AIB-325-AIB-327.md',
      report: {
        ...report,
        metadata: {
          ...report.metadata,
          filePath: 'specs/AIB-330-persist-comparison-data/comparisons/20260321-133600-vs-AIB-325-AIB-327.md',
        },
      },
    });

    const normalized = normalizeComparisonPersistenceRequest(payload);

    expect(payload.report.metadata.generatedAt).toBe(report.metadata.generatedAt.toISOString());
    expect(normalized.report.metadata.generatedAt).toBeInstanceOf(Date);
    expect(normalized.compareRunKey).toBe(compareRunKey);
    expect(normalized.sourceTicketId).toBe(330);
  });

  it('detects missing and malformed payload fields', () => {
    expect(() =>
      normalizeComparisonPersistenceRequest({
        compareRunKey: '',
      })
    ).toThrow();

    expect(() =>
      normalizeComparisonPersistenceRequest({
        compareRunKey: 'cmp_bad',
        projectId: 3,
        sourceTicketId: 330,
        sourceTicketKey: 'AIB-330',
        markdownPath: 'invalid-path.md',
        participantTicketIds: [],
        report: {
          ...serializeComparisonReport(report),
          metadata: {
            ...serializeComparisonReport(report).metadata,
            generatedAt: 'not-a-date',
          },
        },
      })
    ).toThrow();
  });

  it('builds the transient JSON artifact path beside markdown', () => {
    expect(
      getComparisonDataArtifactPath(
        'specs/AIB-330-persist-comparison-data/comparisons/20260321-133600-vs-AIB-325-AIB-327.md'
      )
    ).toBe('specs/AIB-330-persist-comparison-data/comparisons/comparison-data.json');
  });
});
