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

  // Excellent (90-100): green
  it.each([90, 100])('applies green/emerald classes for score %i (Excellent)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('text-emerald-700');
    expect(badge.className).toContain('bg-emerald-100');
  });

  // Good (70-89): blue
  it.each([70, 89])('applies blue classes for score %i (Good)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('text-blue-700');
    expect(badge.className).toContain('bg-blue-100');
  });

  // Fair (50-69): amber
  it.each([50, 69])('applies amber classes for score %i (Fair)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('text-amber-700');
    expect(badge.className).toContain('bg-amber-100');
  });

  // Poor (0-49): red
  it.each([0, 49])('applies red classes for score %i (Poor)', (score) => {
    renderWithProviders(<QualityScoreBadge score={score} />);
    const badge = screen.getByTestId('quality-score-badge');
    expect(badge.className).toContain('text-red-700');
    expect(badge.className).toContain('bg-red-100');
  });
});
