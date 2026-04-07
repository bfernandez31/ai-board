import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../theme';

export const ScoreCircle: React.FC<{ score: number; size?: number; color?: string; delay?: number }> = ({ score, size = 160, color = colors.green, delay = 0 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const currentScore = Math.round(score * progress);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - (score / 100) * progress);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.surface1} strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ filter: `drop-shadow(0 0 10px ${color}60)` }} />
      </svg>
      <div style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.28, fontWeight: 700, color: colors.text, fontFamily: fonts.display }}>{currentScore}</span>
        <span style={{ fontSize: size * 0.1, color: colors.subtext0, fontFamily: fonts.body }}>/ 100</span>
      </div>
    </div>
  );
};
