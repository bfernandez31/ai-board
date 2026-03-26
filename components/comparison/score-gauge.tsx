'use client';

import { useId } from 'react';
import type { ComparisonAccentTheme } from './comparison-theme';

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
  /** Optional accent theme override for participant-rank styling */
  theme?: ComparisonAccentTheme;
  /** Optional stable gradient id for snapshots/tests */
  gradientId?: string;
}

export function ScoreGauge({
  score,
  size = 120,
  strokeWidth = 8,
  animated = true,
  theme,
  gradientId,
}: ScoreGaugeProps) {
  const reactId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;
  const colors = getComparisonScoreColor(clampedScore);
  const gaugeId = gradientId ?? `score-gauge-${reactId.replace(/:/g, '')}`;
  const glowId = `${gaugeId}-glow`;
  const stroke = theme ? `url(#${gaugeId})` : colors.stroke;
  const textClass = theme?.text ?? colors.text;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Score: ${clampedScore}`}
      role="img"
    >
      {theme && (
        <defs>
          <linearGradient id={gaugeId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.ringFrom} />
            <stop offset="100%" stopColor={theme.ringTo} />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation={size * 0.04} floodColor={theme.glow} floodOpacity="0.55" />
          </filter>
        </defs>
      )}
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
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        filter={theme ? `url(#${glowId})` : undefined}
        className={animated ? 'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out' : undefined}
        style={animated ? { '--initial-offset': `${circumference}` } as React.CSSProperties : undefined}
      />
      {/* Score text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className={`fill-current ${textClass}`}
        fontSize={size * 0.28}
        fontWeight="800"
        letterSpacing="-0.04em"
      >
        {clampedScore}
      </text>
    </svg>
  );
}
