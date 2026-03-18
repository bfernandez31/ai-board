/**
 * Component Tests: QualityScoreBadge
 *
 * Tests all 4 threshold colors, null score, and boundary values.
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

  // Excellent (90-100): green (ctp-green token)
  it.each([90, 100])('applies ctp-green classes for score %i (Excellent)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('text-ctp-green');
    expect(badge.className).toContain('bg-ctp-green/10');
  });

  // Good (70-89): blue (ctp-blue token)
  it.each([70, 89])('applies ctp-blue classes for score %i (Good)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('text-ctp-blue');
    expect(badge.className).toContain('bg-ctp-blue/10');
  });

  // Fair (50-69): yellow (ctp-yellow token)
  it.each([50, 69])('applies ctp-yellow classes for score %i (Fair)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('text-ctp-yellow');
    expect(badge.className).toContain('bg-ctp-yellow/10');
  });

  // Poor (0-49): red (ctp-red token)
  it.each([0, 49])('applies ctp-red classes for score %i (Poor)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('text-ctp-red');
    expect(badge.className).toContain('bg-ctp-red/10');
  });
});
