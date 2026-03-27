import { describe, expect, it } from 'vitest';
import { ScoreGauge, getComparisonScoreColor } from '@/components/comparison/score-gauge';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

describe('getComparisonScoreColor', () => {
  it('returns green for score >= 85', () => {
    expect(getComparisonScoreColor(85).text).toBe('text-ctp-green');
    expect(getComparisonScoreColor(100).text).toBe('text-ctp-green');
  });

  it('returns blue for score 70-84', () => {
    expect(getComparisonScoreColor(70).text).toBe('text-ctp-blue');
    expect(getComparisonScoreColor(84).text).toBe('text-ctp-blue');
  });

  it('returns yellow for score 50-69', () => {
    expect(getComparisonScoreColor(50).text).toBe('text-ctp-yellow');
    expect(getComparisonScoreColor(69).text).toBe('text-ctp-yellow');
  });

  it('returns red for score < 50', () => {
    expect(getComparisonScoreColor(0).text).toBe('text-ctp-red');
    expect(getComparisonScoreColor(49).text).toBe('text-ctp-red');
  });
});

describe('ScoreGauge', () => {
  it('renders SVG with correct aria-label', () => {
    renderWithProviders(<ScoreGauge score={85} />);
    expect(screen.getByRole('img', { name: 'Score: 85' })).toBeInTheDocument();
  });

  it('renders score text inside the SVG', () => {
    renderWithProviders(<ScoreGauge score={72} />);
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('computes correct stroke-dashoffset for given score', () => {
    const { container } = renderWithProviders(<ScoreGauge score={50} size={120} strokeWidth={8} />);
    const circles = container.querySelectorAll('circle');
    const scoreCircle = circles[1]; // second circle is the score arc
    const radius = (120 - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const expectedOffset = circumference - (50 / 100) * circumference;
    expect(scoreCircle.getAttribute('stroke-dashoffset')).toBe(String(expectedOffset));
  });

  it('clamps score between 0 and 100', () => {
    renderWithProviders(<ScoreGauge score={150} />);
    expect(screen.getByText('100')).toBeInTheDocument();

    renderWithProviders(<ScoreGauge score={-10} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('applies animation class when animated', () => {
    const { container } = renderWithProviders(<ScoreGauge score={85} animated={true} />);
    const scoreCircle = container.querySelectorAll('circle')[1];
    expect(scoreCircle.getAttribute('class')).toContain('motion-safe:transition');
  });

  it('does not apply animation class when animated is false', () => {
    const { container } = renderWithProviders(<ScoreGauge score={85} animated={false} />);
    const scoreCircle = container.querySelectorAll('circle')[1];
    expect(scoreCircle.getAttribute('class')).toBeNull();
  });

  it('uses gradient stroke referencing score-based color', () => {
    const { container } = renderWithProviders(<ScoreGauge score={90} />);
    const scoreCircle = container.querySelectorAll('circle')[1];
    expect(scoreCircle.getAttribute('stroke')).toContain('url(#');
    // Verify the gradient stops use the green color
    const stops = container.querySelectorAll('stop');
    const stopColors = Array.from(stops).map((s) => s.getAttribute('stop-color'));
    expect(stopColors.some((c) => c?.includes('ctp-green'))).toBe(true);
  });

  it('respects custom size prop', () => {
    const { container } = renderWithProviders(<ScoreGauge score={50} size={40} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('40');
    expect(svg?.getAttribute('height')).toBe('40');
  });

  it('renders SVG defs with linearGradient element', () => {
    const { container } = renderWithProviders(<ScoreGauge score={85} />);
    const defs = container.querySelector('defs');
    expect(defs).not.toBeNull();
    const gradient = defs?.querySelector('linearGradient');
    expect(gradient).not.toBeNull();
  });

  it('renders SVG filter with feDropShadow for glow effect', () => {
    const { container } = renderWithProviders(<ScoreGauge score={85} />);
    const defs = container.querySelector('defs');
    const filter = defs?.querySelector('filter');
    expect(filter).not.toBeNull();
    const dropShadow = filter?.querySelector('feDropShadow');
    expect(dropShadow).not.toBeNull();
  });

  it('applies gradient stroke to score arc via url reference', () => {
    const { container } = renderWithProviders(<ScoreGauge score={85} />);
    const scoreCircle = container.querySelectorAll('circle')[1];
    const stroke = scoreCircle.getAttribute('stroke');
    expect(stroke).toContain('url(#');
  });

  it('uses accent color HSL stops in gradient when accentColor is provided', () => {
    const { container } = renderWithProviders(
      <ScoreGauge score={85} accentColor="hsl(var(--ctp-blue))" />
    );
    const stops = container.querySelectorAll('stop');
    expect(stops.length).toBeGreaterThanOrEqual(2);
    const stopColors = Array.from(stops).map((s) => s.getAttribute('stop-color'));
    expect(stopColors.some((c) => c?.includes('ctp-blue'))).toBe(true);
  });
});
