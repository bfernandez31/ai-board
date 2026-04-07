import React from 'react';
import { colors } from '../theme';

export const MockCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; glowColor?: string }> = ({ children, style, glowColor = colors.mauve }) => {
  return (
    <div style={{ background: `linear-gradient(135deg, ${colors.surface0}cc, ${colors.mantle}ee)`, border: `1px solid ${colors.surface1}`, borderRadius: 16, padding: 20, boxShadow: `0 2px 20px ${glowColor}18`, ...style }}>
      {children}
    </div>
  );
};
