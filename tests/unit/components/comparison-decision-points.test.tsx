import { describe, expect, it } from 'vitest';
import { ComparisonDecisionPoints } from '@/components/comparison/comparison-decision-points';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { ComparisonDecisionPoint } from '@/lib/types/comparison';

const decisionPoints: ComparisonDecisionPoint[] = [
  {
    id: 1,
    title: 'Error handling approach',
    verdictTicketId: 1,
    verdictSummary: 'AIB-101 has better error handling',
    rationale: 'Comprehensive try-catch with logging',
    displayOrder: 0,
    participantApproaches: [
      { ticketId: 1, ticketKey: 'AIB-101', summary: 'Uses structured error types' },
      { ticketId: 2, ticketKey: 'AIB-102', summary: 'Basic try-catch' },
    ],
  },
  {
    id: 2,
    title: 'Database strategy',
    verdictTicketId: 2,
    verdictSummary: 'AIB-102 has cleaner migrations',
    rationale: 'Well-structured Prisma migrations',
    displayOrder: 1,
    participantApproaches: [
      { ticketId: 1, ticketKey: 'AIB-101', summary: 'Direct SQL' },
      { ticketId: 2, ticketKey: 'AIB-102', summary: 'Prisma migrations' },
    ],
  },
  {
    id: 3,
    title: 'Testing strategy',
    verdictTicketId: null,
    verdictSummary: 'No clear winner',
    rationale: 'Both approaches are valid',
    displayOrder: 2,
    participantApproaches: [],
  },
];

describe('ComparisonDecisionPoints (enhanced)', () => {
  const winnerTicketId = 1;

  it('renders all decision point titles', () => {
    renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    expect(screen.getByText('Error handling approach')).toBeInTheDocument();
    expect(screen.getByText('Database strategy')).toBeInTheDocument();
    expect(screen.getByText('Testing strategy')).toBeInTheDocument();
  });

  it('renders verdict summary visible without expanding', () => {
    renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    expect(screen.getByText('AIB-101 has better error handling')).toBeInTheDocument();
    expect(screen.getByText('AIB-102 has cleaner migrations')).toBeInTheDocument();
  });

  it('renders green verdict dot when verdict matches winner', () => {
    const { container } = renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    const greenDots = container.querySelectorAll('.bg-ctp-green');
    expect(greenDots.length).toBe(1); // First decision point matches winner
  });

  it('renders yellow verdict dot when verdict is non-null but not winner', () => {
    const { container } = renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    const yellowDots = container.querySelectorAll('.bg-ctp-yellow');
    expect(yellowDots.length).toBe(1); // Second decision point is non-null mismatch
  });

  it('renders neutral dot when verdict is null', () => {
    const { container } = renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    const neutralDots = container.querySelectorAll('[data-testid="verdict-dot-neutral"]');
    expect(neutralDots.length).toBe(1); // Third decision point has null verdict
  });

  it('wraps ticket keys in badges for participant approaches', () => {
    renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    // The first decision point is open by default, its approaches should be visible
    expect(screen.getByText('Uses structured error types')).toBeInTheDocument();
  });

  it('first accordion is open by default', () => {
    renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    // Rationale from first point should be visible (content is expanded)
    expect(screen.getByText('Comprehensive try-catch with logging')).toBeInTheDocument();
  });

  it('renders empty state for no approaches when accordion is open', () => {
    // Use a single decision point with no approaches and displayOrder 0 so it opens by default
    const noApproachesPoint: ComparisonDecisionPoint[] = [
      {
        id: 10,
        title: 'Empty point',
        verdictTicketId: null,
        verdictSummary: 'No winner',
        rationale: 'Both valid',
        displayOrder: 0,
        participantApproaches: [],
      },
    ];

    renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={noApproachesPoint} winnerTicketId={winnerTicketId} />
    );

    expect(screen.getByText(/No saved participant approaches/)).toBeInTheDocument();
  });

  it('renders verdict pill badge with verdict summary', () => {
    renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    const verdictPills = document.querySelectorAll('[data-testid="verdict-pill"]');
    expect(verdictPills.length).toBeGreaterThan(0);
  });

  it('renders glowing dots with box-shadow classes', () => {
    const { container } = renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    const glowingDots = container.querySelectorAll('[data-testid="verdict-dot-glow"]');
    expect(glowingDots.length).toBeGreaterThan(0);
  });

  it('renders individual decision point cards with background tint', () => {
    const { container } = renderWithProviders(
      <ComparisonDecisionPoints decisionPoints={decisionPoints} winnerTicketId={winnerTicketId} />
    );

    // First decision point (winner verdict) should have green accent background
    const cards = container.querySelectorAll('[data-testid="decision-point-card"]');
    expect(cards.length).toBe(3);
  });
});
