import { describe, expect, it } from 'vitest';
import { ComparisonComplianceHeatmap } from '@/components/comparison/comparison-compliance-heatmap';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonComplianceRow, ComparisonParticipantDetail } from '@/lib/types/comparison';

function makeParticipant(overrides?: Partial<ComparisonParticipantDetail>): ComparisonParticipantDetail {
  return {
    ticketId: 1,
    ticketKey: 'AIB-101',
    title: 'Ticket',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 1,
    score: 90,
    rankRationale: 'Best',
    quality: { state: 'available', value: 88 },
    qualityBreakdown: { state: 'unavailable', value: null },
    telemetry: {
      inputTokens: { state: 'available', value: 5000 },
      outputTokens: { state: 'available', value: 3000 },
      totalTokens: { state: 'available', value: 8000 },
      durationMs: { state: 'available', value: 120000 },
      costUsd: { state: 'available', value: 1.50 },
      jobCount: { state: 'available', value: 2 },
      primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
    },
    metrics: {
      linesAdded: 100,
      linesRemoved: 20,
      linesChanged: 120,
      filesChanged: 8,
      testFilesChanged: 3,
      changedFiles: [],
      bestValueFlags: {},
    },
    ...overrides,
  };
}

const complianceRows: ComparisonComplianceRow[] = [
  {
    principleKey: 'ts-first',
    principleName: 'TypeScript-First',
    displayOrder: 0,
    assessments: [
      { participantTicketId: 1, participantTicketKey: 'AIB-101', status: 'pass', notes: 'All typed' },
      { participantTicketId: 2, participantTicketKey: 'AIB-102', status: 'fail', notes: 'Missing types' },
    ],
  },
  {
    principleKey: 'component-driven',
    principleName: 'Component-Driven',
    displayOrder: 1,
    assessments: [
      { participantTicketId: 1, participantTicketKey: 'AIB-101', status: 'mixed', notes: 'Partial compliance' },
      { participantTicketId: 2, participantTicketKey: 'AIB-102', status: 'pass', notes: 'Well structured' },
    ],
  },
];

describe('ComparisonComplianceHeatmap', () => {
  const participants = [
    makeParticipant({ ticketId: 1, ticketKey: 'AIB-101' }),
    makeParticipant({ ticketId: 2, ticketKey: 'AIB-102' }),
  ];

  it('renders principle names as row labels', () => {
    renderWithProviders(
      <ComparisonComplianceHeatmap rows={complianceRows} participants={participants} />
    );

    expect(screen.getByText('TypeScript-First')).toBeInTheDocument();
    expect(screen.getByText('Component-Driven')).toBeInTheDocument();
  });

  it('renders participant headers', () => {
    renderWithProviders(
      <ComparisonComplianceHeatmap rows={complianceRows} participants={participants} />
    );

    expect(screen.getByText('AIB-101')).toBeInTheDocument();
    expect(screen.getByText('AIB-102')).toBeInTheDocument();
  });

  it('renders colored cells matching status', () => {
    const { container } = renderWithProviders(
      <ComparisonComplianceHeatmap rows={complianceRows} participants={participants} />
    );

    const greenCells = container.querySelectorAll('.bg-ctp-green\\/20');
    const redCells = container.querySelectorAll('.bg-ctp-red\\/20');
    const yellowCells = container.querySelectorAll('.bg-ctp-yellow\\/20');

    expect(greenCells.length).toBe(2); // pass cells
    expect(redCells.length).toBe(1); // fail cell
    expect(yellowCells.length).toBe(1); // mixed cell
  });

  it('does not render text inside cells', () => {
    const { container } = renderWithProviders(
      <ComparisonComplianceHeatmap rows={complianceRows} participants={participants} />
    );

    const cells = container.querySelectorAll('[data-testid="heatmap-cell"]');
    cells.forEach((cell) => {
      expect(cell.textContent?.trim()).toBe('');
    });
  });

  it('renders muted background for missing assessments', () => {
    const rowsWithMissing: ComparisonComplianceRow[] = [
      {
        principleKey: 'security',
        principleName: 'Security',
        displayOrder: 0,
        assessments: [
          { participantTicketId: 1, participantTicketKey: 'AIB-101', status: 'pass', notes: 'Secure' },
          // Missing assessment for participant 2
        ],
      },
    ];

    const { container } = renderWithProviders(
      <ComparisonComplianceHeatmap rows={rowsWithMissing} participants={participants} />
    );

    const mutedCells = container.querySelectorAll('.bg-muted');
    expect(mutedCells.length).toBeGreaterThan(0);
  });

  it('renders unavailable state when no compliance rows', () => {
    renderWithProviders(
      <ComparisonComplianceHeatmap rows={[]} participants={participants} />
    );

    expect(screen.getByText(/No compliance data available/)).toBeInTheDocument();
  });

  it('has sticky first column', () => {
    const { container } = renderWithProviders(
      <ComparisonComplianceHeatmap rows={complianceRows} participants={participants} />
    );

    const stickyHeaders = container.querySelectorAll('.sticky.left-0');
    expect(stickyHeaders.length).toBeGreaterThan(0);
  });
});
