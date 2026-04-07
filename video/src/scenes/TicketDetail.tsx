import React from 'react';
import { AbsoluteFill } from 'remotion';
import { colors, fonts } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { MockCard } from '../components/MockCard';
import { MockBadge } from '../components/MockBadge';
import { useZoomIn, useStagger, useCounter } from '../transitions';

const JOBS = [
  { command: 'specify', status: 'completed', cost: '$0.08', tokens: '2,134', duration: '45s', color: colors.green },
  { command: 'plan', status: 'completed', cost: '$0.12', tokens: '3,847', duration: '1m 12s', color: colors.green },
  { command: 'implement', status: 'completed', cost: '$0.18', tokens: '5,623', duration: '2m 34s', color: colors.green },
  { command: 'verify', status: 'running', cost: '$0.04', tokens: '1,243', duration: '32s...', color: colors.blue },
];

export const TicketDetail: React.FC = () => {
  const zoom = useZoomIn(0);
  const totalCost = useCounter(42, 20, 40);
  const totalTokens = useCounter(12847, 20, 40);

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: zoom.opacity, transform: `scale(${zoom.scale})` }}>
        <MockCard style={{ width: 900, padding: 0, overflow: 'hidden', border: `1px solid ${colors.surface1}` }}>
          {/* Header */}
          <div style={{ padding: '20px 28px', borderBottom: `1px solid ${colors.surface1}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 16, color: colors.text }}>AIB-146</span>
            <MockBadge label="BUILD" color={colors.peachLight} />
            <MockBadge label="FULL" color={colors.lavender} />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: colors.green, fontFamily: fonts.mono }}>⎇ feature/AIB-146-landing-video</span>
          </div>
          {/* Title */}
          <div style={{ padding: '20px 28px 0' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: colors.text, fontFamily: fonts.body, margin: 0 }}>Add landing page video</h2>
          </div>
          {/* Tabs */}
          <div style={{ padding: '16px 28px', display: 'flex', gap: 4 }}>
            <div style={{ padding: '8px 16px', background: colors.surface0, borderRadius: 8, fontSize: 13, color: colors.text, fontWeight: 600 }}>Details</div>
            <div style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, color: colors.subtext0 }}>Conversation</div>
            <div style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, color: colors.subtext0 }}>Files</div>
            <div style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, color: colors.mauve, fontWeight: 600, background: `${colors.mauve}15` }}>Stats</div>
          </div>
          {/* Jobs timeline */}
          <div style={{ padding: '0 28px 20px' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: colors.subtext0, fontWeight: 600 }}>Jobs Timeline</span>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {JOBS.map((job, i) => (
                <JobRow key={job.command} job={job} index={i} />
              ))}
            </div>
            {/* Totals */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 32, padding: '12px 16px', background: `${colors.mauve}10`, borderRadius: 10, border: `1px solid ${colors.mauve}25` }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: colors.yellow, fontFamily: fonts.mono }}>${(totalCost / 100).toFixed(2)}</span>
                <span style={{ fontSize: 11, color: colors.subtext0 }}>total cost</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: colors.blue, fontFamily: fonts.mono }}>{totalTokens.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: colors.subtext0 }}>tokens</span>
              </div>
            </div>
          </div>
        </MockCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const JobRow: React.FC<{ job: typeof JOBS[number]; index: number }> = ({ job, index }) => {
  const stagger = useStagger(index, 10, 6);
  return (
    <div style={{ ...stagger, display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', background: `${colors.surface0}80`, borderRadius: 10, borderLeft: `3px solid ${job.color}` }}>
      <span style={{ fontSize: 14, color: job.color, width: 18, textAlign: 'center' as const }}>{job.status === 'completed' ? '✓' : '◌'}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: fonts.mono, width: 100 }}>{job.command}</span>
      <span style={{ fontSize: 12, color: colors.subtext0, width: 80 }}>{job.duration}</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: colors.yellow, fontFamily: fonts.mono }}>{job.cost}</span>
      <span style={{ fontSize: 12, color: colors.subtext0, fontFamily: fonts.mono }}>{job.tokens} tokens</span>
    </div>
  );
};
