import React from 'react';
import { colors, fonts } from '../theme';
import { MockBadge } from './MockBadge';

export const MockTicket: React.FC<{ ticketKey: string; title: string; stage?: string; cost?: string; style?: React.CSSProperties }> = ({ ticketKey, title, stage, cost, style }) => {
  return (
    <div style={{ background: `linear-gradient(135deg, ${colors.surface0}cc, ${colors.mantle}ee)`, border: `1px solid ${colors.surface1}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.subtext0 }}>{ticketKey}</span>
        {stage && <MockBadge label={stage} color={colors.green} />}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, lineHeight: 1.3 }}>{title}</span>
      {cost && (
        <div style={{ borderTop: `1px solid ${colors.surface1}`, paddingTop: 8, marginTop: 4 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.subtext0 }}>{cost}</span>
        </div>
      )}
    </div>
  );
};
