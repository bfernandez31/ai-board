import React from 'react';
import { fonts } from '../theme';

export const MockColumn: React.FC<{ label: string; color: string; count: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({ label, color, count, children, style }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, ...style }}>
      <div style={{ background: `${color}30`, borderBottom: `2px solid ${color}60`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px 12px 0 0' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.28em', color, fontFamily: fonts.body }}>{label}</span>
        <span style={{ background: `${color}40`, color, fontSize: 10, fontWeight: 700, width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
      </div>
      <div style={{ background: `${color}18`, flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: '0 0 12px 12px', minHeight: 500 }}>
        {children}
      </div>
    </div>
  );
};
