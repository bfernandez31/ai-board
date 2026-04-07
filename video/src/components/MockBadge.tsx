import React from 'react';
import { colors } from '../theme';

export const MockBadge: React.FC<{ label: string; color?: string; style?: React.CSSProperties }> = ({ label, color = colors.mauve, style }) => {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, color, background: `${color}20`, border: `1px solid ${color}40`, ...style }}>
      {label}
    </span>
  );
};
