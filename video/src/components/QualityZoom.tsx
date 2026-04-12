import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts, scoreColor, scoreLabel } from '../theme';
import { MockCard } from './MockCard';
import { ScoreCircle } from './ScoreCircle';

const DIMENSIONS = [
  { label: 'Compliance', weight: '40%', score: 95, color: colors.green },
  { label: 'Bug Detection', weight: '30%', score: 88, color: colors.blue },
  { label: 'Code Comments', weight: '20%', score: 91, color: colors.mauve },
  { label: 'Historical Context', weight: '10%', score: 87, color: colors.yellow },
];

export const QualityZoom: React.FC<{
  ticketKey: string;
  title: string;
  score: number;
  delay: number;
}> = ({ ticketKey, title, score, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 80, stiffness: 160, mass: 0.6 },
    durationInFrames: 20,
  });

  const scale = interpolate(enterProgress, [0, 1], [0.85, 1]);
  const opacity = interpolate(enterProgress, [0, 0.4], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const color = scoreColor(score);

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `${colors.crust}cc`,
          backdropFilter: 'blur(8px)',
        }}
      />

      <MockCard
        glowColor={color}
        style={{
          position: 'relative',
          padding: 36,
          width: 700,
          border: `1px solid ${color}40`,
          boxShadow: `0 0 40px ${color}20`,
        }}
      >
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <ScoreCircle score={score} size={160} color={color} delay={5} />

          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.subtext0 }}>{ticketKey}</span>
              <span style={{ color: colors.surface2, margin: '0 8px' }}>·</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: fonts.body }}>{title}</span>
            </div>
            <span
              style={{
                display: 'inline-block',
                fontSize: 13,
                fontWeight: 600,
                color,
                background: `${color}20`,
                padding: '3px 10px',
                borderRadius: 6,
                marginBottom: 20,
              }}
            >
              {scoreLabel(score)}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {DIMENSIONS.map((dim, i) => {
                const barDelay = delay + 12 + i * 5;
                const barProgress = interpolate(frame - barDelay, [0, 20], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                return (
                  <div key={dim.label}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: colors.subtext0 }}>
                        {dim.label} ({dim.weight})
                      </span>
                      <span style={{ color: dim.color, fontWeight: 600, fontFamily: fonts.mono }}>
                        {Math.round(dim.score * barProgress)}
                      </span>
                    </div>
                    <div style={{ background: colors.surface1, borderRadius: 3, height: 6 }}>
                      <div
                        style={{
                          background: dim.color,
                          borderRadius: 3,
                          height: 6,
                          width: `${dim.score * barProgress}%`,
                          boxShadow: `0 0 8px ${dim.color}40`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </MockCard>
    </div>
  );
};
