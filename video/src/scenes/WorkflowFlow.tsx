import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts, stageColors } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';

const STAGES = [
  { key: 'INBOX', label: 'INBOX', icon: '📥', desc: 'Write your ticket', color: stageColors.INBOX },
  { key: 'SPECIFY', label: 'SPECIFY', icon: '📋', desc: 'AI generates spec', color: stageColors.SPECIFY },
  { key: 'PLAN', label: 'PLAN', icon: '🗺️', desc: 'Architecture planned', color: stageColors.PLAN },
  { key: 'BUILD', label: 'BUILD', icon: '🔨', desc: 'Code implemented', color: stageColors.BUILD },
  { key: 'VERIFY', label: 'VERIFY', icon: '✅', desc: 'Tests & PR created', color: stageColors.VERIFY },
  { key: 'SHIP', label: 'SHIP', icon: '🚀', desc: 'Deployed to production', color: stageColors.SHIP },
];

const PULSE_START = 20;
const STAGE_DELAY = 30;

export const WorkflowFlow: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48 }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 14, textTransform: 'uppercase' as const, letterSpacing: '0.3em', color: colors.subtext0, fontFamily: fonts.body, fontWeight: 600 }}>
            Fully automated workflow
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {STAGES.map((stage, i) => (
            <StageNode key={stage.key} stage={stage} index={i} frame={frame} />
          ))}
        </div>
        {frame >= PULSE_START + 5 * STAGE_DELAY + 20 && (
          <div style={{ opacity: interpolate(frame - (PULSE_START + 5 * STAGE_DELAY + 20), [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
            <span style={{ fontSize: 20, color: colors.subtext1, fontFamily: fonts.body, fontStyle: 'italic' }}>
              From ticket to production in minutes, not days.
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const StageNode: React.FC<{ stage: typeof STAGES[number]; index: number; frame: number }> = ({ stage, index, frame }) => {
  const { fps } = useVideoConfig();
  const stageFrame = PULSE_START + index * STAGE_DELAY;
  const isActive = frame >= stageFrame;

  const progress = spring({ frame: frame - stageFrame, fps, config: { damping: 60, stiffness: 150, mass: 0.6 }, durationInFrames: 25 });
  const glowIntensity = interpolate(frame - stageFrame, [0, 10, 25, 40], [0, 0.8, 0.4, 0.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const connectorProgress = index > 0
    ? interpolate(frame - (stageFrame - STAGE_DELAY / 2), [0, STAGE_DELAY / 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  const prevColor = index > 0 ? (STAGES[index - 1]?.color ?? stage.color) : stage.color;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {index > 0 && (
        <div style={{
          width: 60, height: 3,
          background: `linear-gradient(90deg, ${prevColor}${toHex(connectorProgress)}, ${stage.color}${toHex(connectorProgress)})`,
          borderRadius: 2,
        }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: isActive ? 1 : 0.3, transform: `scale(${isActive ? interpolate(progress, [0, 1], [0.9, 1]) : 0.9})` }}>
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: isActive ? `${stage.color}25` : colors.surface0,
          border: `3px solid ${isActive ? stage.color : colors.surface1}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          boxShadow: isActive ? `0 0 ${40 * glowIntensity}px ${stage.color}60` : 'none',
        }}>
          {stage.icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', color: isActive ? stage.color : colors.surface2, fontFamily: fonts.body }}>{stage.label}</span>
        <span style={{ fontSize: 13, color: isActive ? colors.text : 'transparent', fontFamily: fonts.body, maxWidth: 140, textAlign: 'center' as const, opacity: isActive ? progress : 0 }}>{stage.desc}</span>
      </div>
    </div>
  );
};

function toHex(opacity: number): string {
  return Math.round(opacity * 255).toString(16).padStart(2, '0');
}
