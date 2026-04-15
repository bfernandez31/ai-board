import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { Typewriter } from '../components/Typewriter';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoomOut = interpolate(frame, [0, 20], [1.1, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const ctaDelay = 70;
  const ctaProgress = spring({ frame: frame - ctaDelay, fps, config: { damping: 60, stiffness: 150, mass: 0.5 }, durationInFrames: 20 });
  const ctaPulse = interpolate(frame - ctaDelay - 20, [0, 15, 30], [1, 1.05, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'extend' });

  const fadeOut = interpolate(frame, [100, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, opacity: fadeIn, transform: `scale(${zoomOut})` }}>
        <span style={{ fontSize: 56, fontWeight: 700, color: colors.text, fontFamily: fonts.display, textAlign: 'center' as const }}>
          Built by AI. Verified by standards. Approved by you.
        </span>
        <Typewriter text="Automatically." delay={25} speed={3} fontSize={56} fontFamily={fonts.display} color={colors.mauve} showCursor={true} />
        {frame >= ctaDelay && (
          <div style={{ marginTop: 24, padding: '16px 40px', borderRadius: 12, background: `linear-gradient(135deg, ${colors.mauve}, ${colors.blue})`, opacity: ctaProgress, transform: `scale(${ctaPulse * interpolate(ctaProgress, [0, 1], [0.8, 1])})`, boxShadow: `0 4px 24px ${colors.mauve}40` }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: colors.crust, fontFamily: fonts.body }}>Start building →</span>
          </div>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: colors.crust, opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
