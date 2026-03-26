import { describe, expect, it } from 'vitest';
import {
  createCompareRunKey,
  createComparisonPersistenceRequest,
  getComparisonDataArtifactPath,
  normalizeComparisonPersistenceRequest,
  serializedComparisonReportSchema,
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

describe('decisionPoints Zod schema validation', () => {
  const baseReport = {
    metadata: {
      generatedAt: '2026-03-20T10:00:00.000Z',
      sourceTicket: 'AIB-1',
      comparedTickets: ['AIB-2', 'AIB-3'],
      filePath: 'specs/test/comparisons/test.md',
    },
    summary: 'Test summary',
    alignment: {
      overall: 80,
      dimensions: { requirements: 80, scenarios: 80, entities: 80, keywords: 80 },
      isAligned: true,
      matchingRequirements: ['FR-001'],
      matchingEntities: ['Ticket'],
    },
    implementation: {
      'AIB-2': {
        ticketKey: 'AIB-2',
        linesAdded: 10,
        linesRemoved: 2,
        linesChanged: 12,
        filesChanged: 2,
        changedFiles: [],
        testFilesChanged: 1,
        hasData: true,
      },
    },
    compliance: {
      'AIB-2': {
        overall: 90,
        totalPrinciples: 1,
        passedPrinciples: 1,
        principles: [{ name: 'TypeScript-First', section: 'I', passed: true, notes: '' }],
      },
    },
    recommendation: 'Ship AIB-2',
    warnings: [],
  };

  it('validates a payload with valid decisionPoints', () => {
    const result = serializedComparisonReportSchema.parse({
      ...baseReport,
      decisionPoints: [
        {
          title: 'State management',
          verdictTicketKey: 'AIB-2',
          verdictSummary: 'AIB-2 is better',
          rationale: 'Uses React context properly',
          approaches: [
            { ticketKey: 'AIB-2', summary: 'React context with useReducer' },
            { ticketKey: 'AIB-3', summary: 'Custom pub-sub system' },
          ],
        },
      ],
    });
    expect(result.decisionPoints).toHaveLength(1);
    expect(result.decisionPoints[0].title).toBe('State management');
    expect(result.decisionPoints[0].verdictTicketKey).toBe('AIB-2');
    expect(result.decisionPoints[0].approaches).toHaveLength(2);
  });

  it('accepts null verdictTicketKey for tied decisions', () => {
    const result = serializedComparisonReportSchema.parse({
      ...baseReport,
      decisionPoints: [
        {
          title: 'Error handling',
          verdictTicketKey: null,
          verdictSummary: 'Both equally robust',
          rationale: 'Both implement comprehensive error handling',
          approaches: [],
        },
      ],
    });
    expect(result.decisionPoints[0].verdictTicketKey).toBeNull();
  });

  it('accepts empty approaches array', () => {
    const result = serializedComparisonReportSchema.parse({
      ...baseReport,
      decisionPoints: [
        {
          title: 'Testing strategy',
          verdictTicketKey: 'AIB-2',
          verdictSummary: 'Better coverage',
          rationale: 'More tests',
          approaches: [],
        },
      ],
    });
    expect(result.decisionPoints[0].approaches).toEqual([]);
  });

  it('rejects decisionPoints with missing required fields', () => {
    expect(() =>
      serializedComparisonReportSchema.parse({
        ...baseReport,
        decisionPoints: [{ title: '' }],
      })
    ).toThrow();

    expect(() =>
      serializedComparisonReportSchema.parse({
        ...baseReport,
        decisionPoints: [
          {
            title: 'Valid title',
            verdictTicketKey: 'AIB-2',
            verdictSummary: '',
            rationale: 'Some rationale',
            approaches: [],
          },
        ],
      })
    ).toThrow();
  });

  it('defaults to empty array when decisionPoints is absent', () => {
    const result = serializedComparisonReportSchema.parse(baseReport);
    expect(result.decisionPoints).toEqual([]);
  });

  it('defaults to empty array when decisionPoints is undefined', () => {
    const result = serializedComparisonReportSchema.parse({
      ...baseReport,
      decisionPoints: undefined,
    });
    expect(result.decisionPoints).toEqual([]);
  });
});
