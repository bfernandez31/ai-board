import React from 'react';
import { colors, fonts, scoreColor } from '../theme';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

const JOB_STATUS_CONFIG: Record<JobStatus, { icon: string; color: string }> = {
  PENDING: { icon: '🕐', color: colors.overlay0 },
  RUNNING: { icon: '✏️', color: colors.blue },
  COMPLETED: { icon: '✅', color: colors.green },
  FAILED: { icon: '❌', color: colors.red },
};

export const MockTicket: React.FC<{
  ticketKey: string;
  title: string;
  jobStatus?: JobStatus;
  qualityScore?: number;
  style?: React.CSSProperties;
}> = ({ ticketKey, title, jobStatus, qualityScore, style }) => {
  const qsColor = qualityScore !== undefined ? scoreColor(qualityScore) : undefined;

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colors.surface0}cc, ${colors.mantle}ee)`,
        border: `1px solid ${colors.surface1}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.subtext0 }}>
          {ticketKey}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {qsColor && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: qsColor,
                background: `${qsColor}20`,
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: fonts.mono,
              }}
            >
              {qualityScore}
            </span>
          )}
          {jobStatus && (
            <span
              style={{
                fontSize: 12,
                filter: jobStatus === 'RUNNING' ? `drop-shadow(0 0 4px ${colors.blue})` : undefined,
              }}
            >
              {JOB_STATUS_CONFIG[jobStatus].icon}
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, lineHeight: 1.3 }}>
        {title}
      </span>
    </div>
  );
};
