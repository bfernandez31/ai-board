import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { MockCard } from '../components/MockCard';
import { ScoreCircle } from '../components/ScoreCircle';
import { useSlideIn, useStagger } from '../transitions';

const MODULES = [
  { label: 'Security', score: 96, color: colors.green, icon: '🛡️', summary: 'No vulnerabilities detected' },
  { label: 'Compliance', score: 91, color: colors.green, icon: '📋', summary: 'TypeScript-first: 100%' },
  { label: 'Tests', score: 88, color: colors.blue, icon: '🧪', summary: '94% pass rate, 82% coverage' },
  { label: 'Quality Gate', score: 93, color: colors.green, icon: '🏆', summary: 'All gates passing' },
];

const HEATMAP_DATA = [
  [3, 3, 3, 2, 3, 3],
  [3, 2, 3, 3, 3, 2],
  [3, 3, 3, 3, 2, 3],
  [2, 3, 3, 3, 3, 3],
  [3, 3, 2, 3, 3, 3],
];

function heatmapColor(val: number): string {
  if (val === 3) return colors.green;
  if (val === 2) return colors.yellow;
  return colors.red;
}

export const HealthDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const slide = useSlideIn(0, 'right');
  const heatmapDelay = 40;

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ padding: 60, ...slide }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: colors.text, fontFamily: fonts.display, margin: 0 }}>Health</h1>
          <span style={{ fontSize: 13, color: colors.subtext0 }}>Project health monitoring</span>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
            <MockCard style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <ScoreCircle score={94} size={180} color={colors.green} delay={8} />
              <span style={{ fontSize: 18, fontWeight: 600, color: colors.green, fontFamily: fonts.body }}>Excellent</span>
              <span style={{ fontSize: 12, color: colors.subtext0 }}>Last scan: 2 hours ago</span>
            </MockCard>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {MODULES.map((mod, i) => (
                <ModuleCard key={mod.label} mod={mod} index={i} />
              ))}
            </div>
            <MockCard style={{ padding: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 12, display: 'block' }}>Compliance Heatmap</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {HEATMAP_DATA.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', gap: 3 }}>
                    {row.map((val, ci) => {
                      const cellDelay = heatmapDelay + (ri * 6 + ci) * 2;
                      const cellOpacity = interpolate(frame - cellDelay, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                      return <div key={ci} style={{ width: 32, height: 24, borderRadius: 4, background: heatmapColor(val), opacity: cellOpacity * 0.7 }} />;
                    })}
                  </div>
                ))}
              </div>
            </MockCard>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const ModuleCard: React.FC<{ mod: typeof MODULES[number]; index: number }> = ({ mod, index }) => {
  const stagger = useStagger(index, 12, 5);
  return (
    <div style={stagger}>
      <MockCard glowColor={mod.color} style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{mod.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{mod.label}</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: mod.color, fontFamily: fonts.mono }}>{mod.score}</span>
        </div>
        <span style={{ fontSize: 12, color: colors.subtext0 }}>{mod.summary}</span>
        <div style={{ marginTop: 8, display: 'flex', gap: 2, alignItems: 'flex-end', height: 24 }}>
          {[60, 70, 65, 80, 75, 85, 88, 90, 92, mod.score].map((v, j) => (
            <div key={j} style={{ width: 6, height: `${(v / 100) * 24}px`, background: mod.color, borderRadius: 2, opacity: 0.6 }} />
          ))}
        </div>
      </MockCard>
    </div>
  );
};
