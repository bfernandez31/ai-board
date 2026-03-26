import { describe, expect, it } from 'vitest';
import {
  createComparisonReport,
  persistGeneratedComparisonArtifacts,
} from '@/lib/comparison/comparison-generator';

describe('comparison-generator artifacts', () => {
  it('emits markdown-linked JSON persistence payloads', async () => {
    const report = createComparisonReport(
      'AIB-330',
      ['AIB-325', 'AIB-327'],
      {
        overall: 88,
        dimensions: {
          requirements: 90,
          scenarios: 80,
          entities: 85,
          keywords: 95,
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
          linesAdded: 24,
          linesRemoved: 6,
          linesChanged: 30,
          filesChanged: 4,
          changedFiles: ['app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts'],
          testFilesChanged: 1,
          hasData: true,
        },
      },
      {
        'AIB-325': {
          overall: 91,
          totalPrinciples: 1,
          passedPrinciples: 1,
          principles: [
            {
              name: 'TypeScript-First Development',
              section: 'I',
              passed: true,
              notes: '',
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
              notes: 'Gap',
            },
          ],
        },
      },
      {},
      'Ship AIB-325.',
      []
    );

    const artifacts = await persistGeneratedComparisonArtifacts({
      projectId: 3,
      sourceTicket: {
        id: 330,
        ticketKey: 'AIB-330',
        title: 'Persist comparison data',
        stage: 'BUILD',
        workflowType: 'FULL',
        agent: null,
      },
      participants: [
        {
          id: 325,
          ticketKey: 'AIB-325',
          title: 'Candidate A',
          stage: 'VERIFY',
          workflowType: 'FULL',
          agent: null,
        },
        {
          id: 327,
          ticketKey: 'AIB-327',
          title: 'Candidate B',
          stage: 'PLAN',
          workflowType: 'FULL',
          agent: null,
        },
      ],
      branch: 'AIB-330-persist-comparison-data',
      report,
    });

    expect(artifacts.markdownPath).toBe(
      `specs/AIB-330-persist-comparison-data/comparisons/${report.metadata.filePath}`
    );
    expect(artifacts.artifactPath).toBe(
      'specs/AIB-330-persist-comparison-data/comparisons/comparison-data.json'
    );
    expect(artifacts.compareRunKey).toContain('cmp_');
    expect(artifacts.markdown).toContain('# Comparison Report');
    expect(artifacts.requestPayload.markdownPath).toBe(artifacts.markdownPath);
    expect(artifacts.requestPayload.report.metadata.filePath).toBe(artifacts.markdownPath);
  });
});
