import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { Typewriter } from '../components/Typewriter';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subtitleY = interpolate(frame, [55, 70], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bgOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: colors.crust }} />
      <AuroraBackground opacity={bgOpacity} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{ opacity: logoOpacity, marginBottom: 16 }}>
          <span style={{ fontSize: 28, fontFamily: fonts.display, color: colors.mauve, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>ai-board</span>
        </div>
        <Typewriter text="Write a ticket..." delay={15} speed={2} fontSize={72} fontFamily={fonts.display} color={colors.text} />
        <div style={{ opacity: subtitleOpacity, transform: `translateY(${subtitleY}px)` }}>
          <span style={{ fontSize: 36, fontFamily: fonts.display, background: `linear-gradient(90deg, ${colors.blue}, ${colors.mauve}, ${colors.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            We handle the rest.
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
