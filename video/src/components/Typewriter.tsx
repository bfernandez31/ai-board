import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../theme';

export const Typewriter: React.FC<{ text: string; delay?: number; speed?: number; fontSize?: number; color?: string; fontFamily?: string; showCursor?: boolean }> = ({ text, delay = 0, speed = 2, fontSize = 64, color = colors.text, fontFamily = fonts.display, showCursor = true }) => {
  const frame = useCurrentFrame();
  const adjustedFrame = frame - delay;
  const charsVisible = Math.floor(interpolate(adjustedFrame, [0, text.length * speed], [0, text.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const cursorOpacity = Math.round(frame / 15) % 2 === 0 ? 1 : 0;
  const isDone = charsVisible >= text.length;

  return (
    <span style={{ fontSize, fontFamily, color, display: 'inline' }}>
      {text.slice(0, charsVisible)}
      {showCursor && <span style={{ opacity: isDone ? cursorOpacity : 1, color: colors.mauve, fontWeight: 300 }}>|</span>}
    </span>
  );
};
