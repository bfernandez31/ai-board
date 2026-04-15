import React from 'react';
import { AbsoluteFill } from 'remotion';
import { colors, fonts } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { MockCard } from '../components/MockCard';
import { ScoreCircle } from '../components/ScoreCircle';
import { useSlideIn, useStagger, useCounter } from '../transitions';

const MODULES = [
  { label: 'Security', score: 96, color: colors.green, icon: '🛡️', summary: 'No vulnerabilities detected' },
  { label: 'Compliance', score: 91, color: colors.green, icon: '📋', summary: 'TypeScript-first: 100%' },
  { label: 'Tests', score: 88, color: colors.blue, icon: '🧪', summary: '94% pass rate, 82% coverage' },
  { label: 'Quality Gate', score: 93, color: colors.green, icon: '🏆', summary: 'All gates passing' },
];

export const ResultsHealth: React.FC = () => {
  const slide = useSlideIn(0, 'right');
  const shippedCount = useCounter(138, 8, 30);
  const successRate = useCounter(94, 8, 30);

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ padding: 60, ...slide }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: colors.text, fontFamily: fonts.display, margin: 0 }}>
            Results
          </h1>
          <span style={{ fontSize: 13, color: colors.subtext0 }}>Project health & metrics</span>
        </div>

        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <MetricCard label="Shipped" value={shippedCount} color={colors.green} icon="🚀" index={0} />
              <MetricCard label="Success Rate" value={`${successRate}%`} color={colors.green} icon="✓" index={1} />
            </div>

            <MockCard style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <ScoreCircle score={94} size={180} color={colors.green} delay={12} />
              <span style={{ fontSize: 18, fontWeight: 600, color: colors.green, fontFamily: fonts.body }}>
                Excellent
              </span>
              <span style={{ fontSize: 12, color: colors.subtext0 }}>Overall health score</span>
            </MockCard>
          </div>

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {MODULES.map((mod, i) => (
              <ModuleCard key={mod.label} mod={mod} index={i} />
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: number | string;
  color: string;
  icon: string;
  index: number;
}> = ({ label, value, color, icon, index }) => {
  const stagger = useStagger(index, 4, 5);
  return (
    <div style={stagger}>
      <MockCard glowColor={color} style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div>
          <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: fonts.mono, display: 'block' }}>
            {value}
          </span>
          <span style={{ fontSize: 11, color: colors.subtext0 }}>{label}</span>
        </div>
      </MockCard>
    </div>
  );
};

const ModuleCard: React.FC<{ mod: typeof MODULES[number]; index: number }> = ({ mod, index }) => {
  const stagger = useStagger(index, 15, 5);
  return (
    <div style={stagger}>
      <MockCard glowColor={mod.color} style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{mod.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{mod.label}</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: mod.color, fontFamily: fonts.mono }}>
            {mod.score}
          </span>
        </div>
        <span style={{ fontSize: 12, color: colors.subtext0 }}>{mod.summary}</span>
      </MockCard>
    </div>
  );
};
