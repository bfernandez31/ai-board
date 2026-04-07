import React from 'react';
import { AbsoluteFill } from 'remotion';
import { colors, fonts } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { MockCard } from '../components/MockCard';
import { MockLineChart, MockBarChart } from '../components/MockChart';
import { usePerspectiveShift, useStagger } from '../transitions';

const COST_DATA = [12, 18, 15, 22, 19, 28, 25, 32, 27, 35, 30, 38];
const TOKEN_BARS = [
  { label: 'specify', value: 2100, color: colors.lavender },
  { label: 'plan', value: 3800, color: colors.blue },
  { label: 'build', value: 5600, color: colors.peachLight },
  { label: 'verify', value: 1900, color: colors.flamingo },
];

const OVERVIEW_CARDS = [
  { label: 'Total Cost', value: '$127.42', color: colors.yellow, icon: '💰' },
  { label: 'Success Rate', value: '94.2%', color: colors.green, icon: '✓' },
  { label: 'Avg Duration', value: '18m', color: colors.blue, icon: '⏱' },
  { label: 'Shipped', value: '138', color: colors.mauve, icon: '🚀' },
  { label: 'Closed', value: '12', color: colors.pink, icon: '📦' },
];

export const Analytics: React.FC = () => {
  const perspective = usePerspectiveShift(0, 'left');

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ padding: 60, ...perspective }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: colors.text, fontFamily: fonts.display, margin: 0 }}>Analytics</h1>
          <span style={{ fontSize: 13, color: colors.subtext0 }}>ai-board — Last 30 days</span>
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {OVERVIEW_CARDS.map((card, i) => (
            <OverviewCard key={card.label} card={card} index={i} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <MockCard style={{ flex: 2, padding: 24 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 16, display: 'block' }}>Cost Over Time</span>
            <MockLineChart data={COST_DATA} color={colors.yellow} width={640} height={220} delay={15} />
          </MockCard>
          <MockCard style={{ flex: 1, padding: 24 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 16, display: 'block' }}>Tokens by Stage</span>
            <MockBarChart data={TOKEN_BARS} width={320} height={220} delay={25} />
          </MockCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const OverviewCard: React.FC<{ card: typeof OVERVIEW_CARDS[number]; index: number }> = ({ card, index }) => {
  const stagger = useStagger(index, 5, 4);
  return (
    <div style={{ flex: 1, ...stagger }}>
      <MockCard glowColor={card.color} style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: colors.subtext0, fontFamily: fonts.body }}>{card.label}</span>
          <span style={{ fontSize: 16 }}>{card.icon}</span>
        </div>
        <span style={{ fontSize: 26, fontWeight: 700, color: colors.text, fontFamily: fonts.mono }}>{card.value}</span>
      </MockCard>
    </div>
  );
};
