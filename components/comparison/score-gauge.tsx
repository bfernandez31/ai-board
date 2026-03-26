'use client';

/**
 * Comparison-specific score color helper.
 * Thresholds: green (>=85), blue (70-84), yellow (50-69), red (<50).
 * Separate from lib/quality-score.ts which uses 90+ for green.
 */
export function getComparisonScoreColor(score: number): {
  text: string;
  bg: string;
  stroke: string;
} {
  if (score >= 85) {
    return {
      text: 'text-ctp-green',
      bg: 'bg-ctp-green/10',
      stroke: 'hsl(var(--ctp-green))',
    };
  }
  if (score >= 70) {
    return {
      text: 'text-ctp-blue',
      bg: 'bg-ctp-blue/10',
      stroke: 'hsl(var(--ctp-blue))',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-ctp-yellow',
      bg: 'bg-ctp-yellow/10',
      stroke: 'hsl(var(--ctp-yellow))',
    };
  }
  return {
    text: 'text-ctp-red',
    bg: 'bg-ctp-red/10',
    stroke: 'hsl(var(--ctp-red))',
  };
}

interface ScoreGaugeProps {
  /** Score value (0-100) */
  score: number;
  /** Diameter of the gauge in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether to animate on mount */
  animated?: boolean;
}

export function ScoreGauge({
  score,
  size = 120,
  strokeWidth = 8,
  animated = true,
}: ScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;
  const colors = getComparisonScoreColor(clampedScore);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Score: ${clampedScore}`}
      role="img"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
      />
      {/* Score arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={animated ? 'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out' : undefined}
        style={animated ? { '--initial-offset': `${circumference}` } as React.CSSProperties : undefined}
      />
      {/* Score text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className={`fill-current ${colors.text}`}
        fontSize={size * 0.28}
        fontWeight="bold"
      >
        {clampedScore}
      </text>
    </svg>
  );
}
