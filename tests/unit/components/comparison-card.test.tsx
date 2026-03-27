/**
 * RTL Component Tests: ComparisonCard
 *
 * Tests for the compact comparison card with inline expand behavior.
 * Verifies winner key, title, summary, score badge, date rendering,
 * and accordion expand/collapse behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComparisonCard } from '@/components/comparison/comparison-card';
import type { ComparisonCardProps } from '@/components/comparison/types';
import type { ProjectComparisonSummary } from '@/lib/types/comparison';

const mockComparison: ProjectComparisonSummary = {
  id: 42,
  generatedAt: '2026-03-25T14:30:00.000Z',
  sourceTicketId: 10,
  sourceTicketKey: 'AIB-100',
  participantTicketIds: [11, 12],
  participantTicketKeys: ['AIB-101', 'AIB-102'],
  winnerTicketId: 11,
  winnerTicketKey: 'AIB-101',
  winnerTicketTitle: 'Implement feature X with optimized approach',
  winnerScore: 87.5,
  summary: 'AIB-101 demonstrated superior code quality and test coverage compared to other participants.',
  recommendation: 'Proceed with AIB-101',
  overallRecommendation: 'Proceed with AIB-101',
  keyDifferentiators: ['Better test coverage', 'Lower cost'],
  markdownPath: '/comparisons/AIB-100/comparison-42.md',
};

const defaultProps: ComparisonCardProps = {
  comparison: mockComparison,
  isExpanded: false,
  detail: undefined,
  isDetailLoading: false,
  onToggle: vi.fn(),
};

describe('ComparisonCard', () => {
  describe('compact rendering', () => {
    it('should render the winner ticket key', () => {
      render(<ComparisonCard {...defaultProps} />);
      expect(screen.getByText('AIB-101')).toBeInTheDocument();
    });

    it('should render the winner ticket title', () => {
      render(<ComparisonCard {...defaultProps} />);
      expect(screen.getByText('Implement feature X with optimized approach')).toBeInTheDocument();
    });

    it('should render a truncated summary', () => {
      render(<ComparisonCard {...defaultProps} />);
      expect(screen.getByText(/AIB-101 demonstrated superior/)).toBeInTheDocument();
    });

    it('should render the score badge with trophy icon', () => {
      render(<ComparisonCard {...defaultProps} />);
      expect(screen.getByText('87.5')).toBeInTheDocument();
    });

    it('should not render score badge when winnerScore is null', () => {
      const noScoreComparison = { ...mockComparison, winnerScore: null };
      render(<ComparisonCard {...defaultProps} comparison={noScoreComparison} />);
      expect(screen.queryByText('87.5')).not.toBeInTheDocument();
    });

    it('should render the formatted date', () => {
      render(<ComparisonCard {...defaultProps} />);
      expect(screen.getByText('Mar 25, 2026')).toBeInTheDocument();
    });

    it('should have the correct test id', () => {
      render(<ComparisonCard {...defaultProps} />);
      expect(screen.getByTestId('comparison-card-42')).toBeInTheDocument();
    });
  });

  describe('expand/collapse behavior', () => {
    it('should call onToggle when card is clicked', async () => {
      const onToggle = vi.fn();
      render(<ComparisonCard {...defaultProps} onToggle={onToggle} />);

      const card = screen.getByTestId('comparison-card-42');
      await userEvent.click(card);
      expect(onToggle).toHaveBeenCalledOnce();
    });

    it('should show loading state when detail is loading', () => {
      render(<ComparisonCard {...defaultProps} isExpanded={true} isDetailLoading={true} />);
      expect(screen.getByText('Loading comparison detail...')).toBeInTheDocument();
    });

    it('should show error state when expanded but no detail and not loading', () => {
      render(<ComparisonCard {...defaultProps} isExpanded={true} detail={undefined} isDetailLoading={false} />);
      expect(screen.getByText('Unable to load comparison detail.')).toBeInTheDocument();
    });

    it('should apply expanded border style when isExpanded is true', () => {
      render(<ComparisonCard {...defaultProps} isExpanded={true} />);
      const card = screen.getByTestId('comparison-card-42');
      expect(card.className).toContain('border-primary');
    });

    it('should apply collapsed border style when isExpanded is false', () => {
      render(<ComparisonCard {...defaultProps} isExpanded={false} />);
      const card = screen.getByTestId('comparison-card-42');
      expect(card.className).toContain('border-border');
    });

    it('should rotate chevron when expanded', () => {
      const { container } = render(<ComparisonCard {...defaultProps} isExpanded={true} />);
      const chevron = container.querySelector('.lucide-chevron-down');
      expect(chevron).toBeTruthy();
      // The rotate-180 class is on a wrapper div around the SVG
      const wrapper = chevron!.closest('.transition-transform');
      expect(wrapper?.className).toContain('rotate-180');
    });

    it('should not rotate chevron when collapsed', () => {
      const { container } = render(<ComparisonCard {...defaultProps} isExpanded={false} />);
      const chevron = container.querySelector('.lucide-chevron-down');
      expect(chevron).toBeTruthy();
      const wrapper = chevron!.closest('.transition-transform');
      expect(wrapper?.className).not.toContain('rotate-180');
    });
  });

  describe('single-expand accordion (US2)', () => {
    it('should render two cards where only the expanded one has active style', () => {
      const comparison2 = { ...mockComparison, id: 43, winnerTicketKey: 'AIB-102' };

      const { container } = render(
        <div>
          <ComparisonCard {...defaultProps} comparison={mockComparison} isExpanded={true} />
          <ComparisonCard {...defaultProps} comparison={comparison2} isExpanded={false} />
        </div>
      );

      const card1 = container.querySelector('[data-testid="comparison-card-42"]');
      const card2 = container.querySelector('[data-testid="comparison-card-43"]');

      expect(card1?.className).toContain('border-primary');
      expect(card2?.className).toContain('border-border');
    });

    it('should call onToggle with correct comparison when either card is clicked', async () => {
      const onToggle1 = vi.fn();
      const onToggle2 = vi.fn();
      const comparison2 = { ...mockComparison, id: 43, winnerTicketKey: 'AIB-102' };

      render(
        <div>
          <ComparisonCard {...defaultProps} comparison={mockComparison} onToggle={onToggle1} />
          <ComparisonCard {...defaultProps} comparison={comparison2} onToggle={onToggle2} />
        </div>
      );

      await userEvent.click(screen.getByTestId('comparison-card-43'));
      expect(onToggle2).toHaveBeenCalledOnce();
      expect(onToggle1).not.toHaveBeenCalled();
    });
  });
});
