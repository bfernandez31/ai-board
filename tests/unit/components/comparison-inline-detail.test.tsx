/**
 * Component Test: ComparisonInlineDetail
 * Feature: AIB-358-comparisons-hub-page
 *
 * Tests for the inline detail wrapper component's loading, rendering, and collapse behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComparisonInlineDetail } from '@/components/comparisons/comparison-inline-detail';
import type { ComparisonDetail } from '@/lib/types/comparison';

// Mock comparison sub-components to avoid deep rendering
vi.mock('@/components/comparison/comparison-hero-card', () => ({
  ComparisonHeroCard: () => <div data-testid="hero-card">HeroCard</div>,
}));
vi.mock('@/components/comparison/comparison-participant-grid', () => ({
  ComparisonParticipantGrid: () => <div data-testid="participant-grid">ParticipantGrid</div>,
}));
vi.mock('@/components/comparison/comparison-stat-cards', () => ({
  ComparisonStatCards: () => <div data-testid="stat-cards">StatCards</div>,
}));
vi.mock('@/components/comparison/comparison-unified-metrics', () => ({
  ComparisonUnifiedMetrics: () => <div data-testid="unified-metrics">UnifiedMetrics</div>,
}));
vi.mock('@/components/comparison/comparison-decision-points', () => ({
  ComparisonDecisionPoints: () => <div data-testid="decision-points">DecisionPoints</div>,
}));
vi.mock('@/components/comparison/comparison-compliance-heatmap', () => ({
  ComparisonComplianceHeatmap: () => <div data-testid="compliance-heatmap">ComplianceHeatmap</div>,
}));

function createMockDetail(): ComparisonDetail {
  return {
    id: 1,
    generatedAt: '2026-03-20T09:00:00.000Z',
    sourceTicketId: 10,
    sourceTicketKey: 'AIB-101',
    markdownPath: 'specs/AIB-101/comparisons/example.md',
    summary: 'Winner had best test coverage.',
    overallRecommendation: 'Choose AIB-102 for the implementation baseline.',
    keyDifferentiators: ['coverage', 'smaller diff'],
    winnerTicketId: 11,
    winnerTicketKey: 'AIB-102',
    participants: [
      {
        ticketId: 11,
        ticketKey: 'AIB-102',
        title: 'Winner ticket',
        stage: 'VERIFY',
        workflowType: 'FULL',
        agent: null,
        rank: 1,
        score: 91,
        rankRationale: 'Strong verify results.',
        quality: { state: 'available', value: 91 },
        qualityBreakdown: { state: 'unavailable', value: null },
        telemetry: {
          inputTokens: { state: 'unavailable', value: null },
          outputTokens: { state: 'unavailable', value: null },
          totalTokens: { state: 'unavailable', value: null },
          durationMs: { state: 'unavailable', value: null },
          costUsd: { state: 'unavailable', value: null },
          jobCount: { state: 'unavailable', value: null },
          primaryModel: { state: 'unavailable', value: null },
        },
        metrics: {
          linesAdded: 20,
          linesRemoved: 5,
          linesChanged: 25,
          filesChanged: 3,
          testFilesChanged: 2,
          changedFiles: [],
          bestValueFlags: {},
        },
      },
      {
        ticketId: 12,
        ticketKey: 'AIB-103',
        title: 'Other ticket',
        stage: 'PLAN',
        workflowType: 'FULL',
        agent: null,
        rank: 2,
        score: 75,
        rankRationale: 'Good direction but less coverage.',
        quality: { state: 'unavailable', value: null },
        qualityBreakdown: { state: 'unavailable', value: null },
        telemetry: {
          inputTokens: { state: 'unavailable', value: null },
          outputTokens: { state: 'unavailable', value: null },
          totalTokens: { state: 'unavailable', value: null },
          durationMs: { state: 'unavailable', value: null },
          costUsd: { state: 'unavailable', value: null },
          jobCount: { state: 'unavailable', value: null },
          primaryModel: { state: 'unavailable', value: null },
        },
        metrics: {
          linesAdded: 50,
          linesRemoved: 15,
          linesChanged: 65,
          filesChanged: 5,
          testFilesChanged: 1,
          changedFiles: [],
          bestValueFlags: {},
        },
      },
    ],
    decisionPoints: [
      {
        id: 1,
        title: 'State handling',
        verdictTicketId: 11,
        verdictSummary: 'AIB-102 handled pending states cleanly.',
        rationale: 'The winner kept unavailable telemetry explicit.',
        displayOrder: 0,
        participantApproaches: [],
      },
    ],
    complianceRows: [
      {
        principleKey: 'typescript-first-development',
        principleName: 'TypeScript-First Development',
        displayOrder: 0,
        assessments: [
          {
            participantTicketId: 11,
            participantTicketKey: 'AIB-102',
            status: 'pass',
            notes: 'Strict types retained.',
          },
        ],
      },
    ],
  };
}

describe('ComparisonInlineDetail', () => {
  it('should render loading skeleton when isLoading is true', () => {
    const { container } = render(
      <ComparisonInlineDetail detail={null} isLoading={true} onCollapse={vi.fn()} />
    );

    const skeletons = container.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render loading skeleton when detail is null', () => {
    const { container } = render(
      <ComparisonInlineDetail detail={null} isLoading={false} onCollapse={vi.fn()} />
    );

    // When detail is null and not loading, it shows loading skeleton (waiting for data)
    const skeletons = container.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render all comparison sub-components when detail is provided', () => {
    const detail = createMockDetail();

    render(
      <ComparisonInlineDetail detail={detail} isLoading={false} onCollapse={vi.fn()} />
    );

    expect(screen.getByTestId('hero-card')).toBeInTheDocument();
    expect(screen.getByTestId('participant-grid')).toBeInTheDocument();
    expect(screen.getByTestId('stat-cards')).toBeInTheDocument();
    expect(screen.getByTestId('unified-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('decision-points')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-heatmap')).toBeInTheDocument();
  });

  it('should render collapse button', () => {
    const detail = createMockDetail();

    render(
      <ComparisonInlineDetail detail={detail} isLoading={false} onCollapse={vi.fn()} />
    );

    expect(screen.getByText('Collapse')).toBeInTheDocument();
  });

  it('should call onCollapse when collapse button is clicked', () => {
    const detail = createMockDetail();
    const onCollapse = vi.fn();

    render(
      <ComparisonInlineDetail detail={detail} isLoading={false} onCollapse={onCollapse} />
    );

    fireEvent.click(screen.getByText('Collapse'));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it('should have correct test ID for identification', () => {
    const detail = createMockDetail();

    render(
      <ComparisonInlineDetail detail={detail} isLoading={false} onCollapse={vi.fn()} />
    );

    expect(screen.getByTestId('comparison-inline-detail')).toBeInTheDocument();
  });
});
