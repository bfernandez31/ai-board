import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../theme';

export const MockLineChart: React.FC<{ data: number[]; color?: string; width?: number; height?: number; delay?: number }> = ({ data, color = colors.blue, width = 400, height = 200, delay = 0 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const maxVal = Math.max(...data);
  const points = data.map((v, i) => ({ x: (i / (data.length - 1)) * width, y: height - (v / maxVal) * height * 0.8 - height * 0.1 }));
  const visibleCount = Math.floor(progress * points.length);
  const pathD = points.slice(0, visibleCount + 1).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {[0.25, 0.5, 0.75].map((pct) => (
        <line key={pct} x1={0} y1={height * pct} x2={width} y2={height * pct} stroke={colors.surface1} strokeWidth={1} strokeDasharray="4,4" />
      ))}
      {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />}
      {visibleCount > 0 && points[visibleCount] && (
        <circle cx={points[visibleCount].x} cy={points[visibleCount].y} r={5} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      )}
    </svg>
  );
};

export const MockBarChart: React.FC<{ data: { label: string; value: number; color: string }[]; width?: number; height?: number; delay?: number }> = ({ data, width = 400, height = 200, delay = 0 }) => {
  const frame = useCurrentFrame();
  const maxVal = Math.max(...data.map((d) => d.value));
  const barWidth = width / data.length - 12;

  return (
    <svg width={width} height={height + 24}>
      {data.map((d, i) => {
        const progress = interpolate(frame - delay - i * 3, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const barHeight = (d.value / maxVal) * height * 0.8 * progress;
        const x = i * (barWidth + 12) + 6;
        const y = height - barHeight;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={6} fill={d.color} opacity={0.85} />
            <text x={x + barWidth / 2} y={height + 16} textAnchor="middle" fill={colors.subtext0} fontSize={10} fontFamily={fonts.body}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};
