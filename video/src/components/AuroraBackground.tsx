import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors } from '../theme';

export const AuroraBackground: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();
  const gradientAngle = interpolate(frame, [0, 300], [135, 180], { extrapolateRight: 'extend' });
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradientAngle}deg, ${colors.crust} 0%, ${colors.base} 30%, ${colors.surface0}22 60%, ${colors.mauve}15 80%, ${colors.blue}10 100%)`,
        opacity,
      }}
    />
  );
};
