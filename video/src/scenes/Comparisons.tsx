import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { MockCard } from '../components/MockCard';
import { ScoreCircle } from '../components/ScoreCircle';
import { MockBadge } from '../components/MockBadge';

const MODELS = [
  { name: 'Claude', score: 94, color: colors.mauve, metrics: { quality: 96, speed: 91, cost: 93 } },
  { name: 'Codex', score: 87, color: colors.blue, metrics: { quality: 88, speed: 92, cost: 82 } },
];

function toHex(opacity: number): string {
  return Math.round(opacity * 128).toString(16).padStart(2, '0');
}

export const Comparisons: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flipProgress = spring({ frame, fps, config: { damping: 60, stiffness: 120, mass: 0.8 }, durationInFrames: 25 });
  const rotateY = interpolate(flipProgress, [0, 1], [90, 0]);
  const opacity = interpolate(flipProgress, [0, 0.3, 1], [0, 1, 1]);
  const winnerGlow = interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, opacity, transform: `perspective(1200px) rotateY(${rotateY}deg)` }}>
        <div style={{ textAlign: 'center' as const }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.2em', color: colors.subtext0, fontWeight: 600 }}>AI Model Comparison</span>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: colors.text, fontFamily: fonts.display, margin: '8px 0 0' }}>Which agent performs best?</h2>
        </div>
        <div style={{ display: 'flex', gap: 40, alignItems: 'stretch' }}>
          {MODELS.map((model, i) => (
            <ModelCard key={model.name} model={model} index={i} frame={frame} winnerGlow={winnerGlow} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const ModelCard: React.FC<{ model: typeof MODELS[number]; index: number; frame: number; winnerGlow: number }> = ({ model, index, frame, winnerGlow }) => {
  const isWinner = model.score >= 94;
  return (
    <MockCard
      glowColor={model.color}
      style={{
        width: 360, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        border: isWinner ? `2px solid ${model.color}${toHex(winnerGlow)}` : `1px solid ${colors.surface1}`,
        boxShadow: isWinner ? `0 0 ${30 * winnerGlow}px ${model.color}30` : undefined,
      }}
    >
      {isWinner && winnerGlow > 0.5 && <MockBadge label="🏆 WINNER" color={model.color} style={{ opacity: winnerGlow }} />}
      <span style={{ fontSize: 22, fontWeight: 700, color: model.color, fontFamily: fonts.display }}>{model.name}</span>
      <ScoreCircle score={model.score} size={140} color={model.color} delay={15 + index * 10} />
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(model.metrics).map(([key, value]) => {
          const barProgress = interpolate(frame - 30 - index * 10, [0, 25], [0, value / 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: colors.subtext0, textTransform: 'capitalize' as const }}>{key}</span>
                <span style={{ fontSize: 12, color: colors.text, fontFamily: fonts.mono }}>{value}</span>
              </div>
              <div style={{ height: 6, background: colors.surface0, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barProgress * 100}%`, background: model.color, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </MockCard>
  );
};
