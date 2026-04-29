/**
 * Component Tests: QualityScoreBadge
 *
 * Tests the 4-tier quality scale (low/med/high/best) and null score.
 * Aligns with lib/quality-score.ts thresholds (90/70/50).
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { QualityScoreBadge } from '@/components/ticket/quality-score-badge';

describe('QualityScoreBadge', () => {
  it('renders nothing when score is null', () => {
    const { container } = renderWithProviders(<QualityScoreBadge score={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('displays the score value', () => {
    renderWithProviders(<QualityScoreBadge score={83} />);
    expect(screen.getByTestId('quality-score-badge')).toHaveTextContent('83');
  });

  // Excellent (90-100) → best (green)
  it.each([90, 100])('applies quality=best for score %i (Excellent)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('ab-level-quality-best');
  });

  // Good (70-89) → high (blue)
  it.each([70, 89])('applies quality=high for score %i (Good)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('ab-level-quality-high');
  });

  // Fair (50-69) → med (yellow)
  it.each([50, 69])('applies quality=med for score %i (Fair)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('ab-level-quality-med');
  });

  // Poor (0-49) → low (red)
  it.each([0, 49])('applies quality=low for score %i (Poor)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('ab-level-quality-low');
  });
});
