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
    'Ship AIB-325.',
    []
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
      sourceTicketKey: 'AIB-330',
      participantTicketKeys: ['AIB-325', 'AIB-327'],
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
    expect(normalized.sourceTicketKey).toBe('AIB-330');
    expect(normalized.participantTicketKeys).toEqual(['AIB-325', 'AIB-327']);
    expect(normalized.report.decisionPoints).toEqual([]);
  });

  it('preserves structured decision points in the persistence payload', () => {
    const reportWithDecisionPoints = {
      ...report,
      decisionPoints: [
        {
          title: 'Telemetry Aggregation Strategy',
          winnerTicketKey: 'AIB-325',
          verdict: 'AIB-325 keeps aggregation in aggregateJobTelemetry().',
          rationale: 'It centralizes job state handling and avoids duplicating pending-state logic.',
          participantApproaches: {
            'AIB-325': 'Uses aggregateJobTelemetry() plus a separate in-progress query.',
            'AIB-327': 'Extracts aggregation into a standalone telemetry-extractor module.',
          },
        },
      ],
    };

    const payload = createComparisonPersistenceRequest({
      compareRunKey: createCompareRunKey(
        'AIB-330',
        ['AIB-325', 'AIB-327'],
        report.metadata.generatedAt
      ),
      projectId: 3,
      sourceTicketKey: 'AIB-330',
      participantTicketKeys: ['AIB-325', 'AIB-327'],
      markdownPath: 'specs/AIB-330-persist-comparison-data/comparisons/20260321-133600-vs-AIB-325-AIB-327.md',
      report: {
        ...reportWithDecisionPoints,
        metadata: {
          ...report.metadata,
          filePath: 'specs/AIB-330-persist-comparison-data/comparisons/20260321-133600-vs-AIB-325-AIB-327.md',
        },
      },
    });

    const normalized = normalizeComparisonPersistenceRequest(payload);

    expect(normalized.report.decisionPoints).toEqual(reportWithDecisionPoints.decisionPoints);
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
        sourceTicketKey: 'AIB-330',
        participantTicketKeys: [],
        markdownPath: 'invalid-path.md',
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
