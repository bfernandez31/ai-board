import React from 'react';
import { AbsoluteFill } from 'remotion';
import { colors, fonts } from '../theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { MockCard } from '../components/MockCard';
import { MockBadge } from '../components/MockBadge';
import { useZoomIn, useStagger, useCounter } from '../transitions';

const PROJECTS = [
  { name: 'ai-board', repo: 'bfernandez31/ai-board', tickets: 142, shipped: 'AIB-138' },
  { name: 'web-app', repo: 'acme/web-app', tickets: 87, shipped: 'WEB-84' },
  { name: 'api-service', repo: 'acme/api-service', tickets: 53, shipped: 'API-51' },
  { name: 'mobile-app', repo: 'acme/mobile-app', tickets: 34, shipped: 'MOB-31' },
  { name: 'design-system', repo: 'acme/design-system', tickets: 28, shipped: 'DSN-26' },
  { name: 'infra', repo: 'acme/infra', tickets: 19, shipped: 'INF-17' },
];

export const Dashboard: React.FC = () => {
  const zoom = useZoomIn(0);
  const ticketCount = useCounter(363, 10, 40);

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ padding: 80, opacity: zoom.opacity, transform: `scale(${zoom.scale})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: colors.text, fontFamily: fonts.display, margin: 0 }}>Projects</h1>
            <span style={{ fontSize: 14, color: colors.subtext0, fontFamily: fonts.body }}>6 projects</span>
          </div>
          <MockCard style={{ padding: '12px 24px', display: 'flex', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: colors.mauve, fontFamily: fonts.mono }}>{ticketCount}</span>
              <span style={{ fontSize: 11, color: colors.subtext0 }}>tickets</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: colors.green, fontFamily: fonts.mono }}>94%</span>
              <span style={{ fontSize: 11, color: colors.subtext0 }}>pass rate</span>
            </div>
          </MockCard>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          {PROJECTS.map((project, i) => (
            <StaggeredCard key={project.name} project={project} index={i} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Extracted to avoid hooks-in-loop violation
const StaggeredCard: React.FC<{ project: typeof PROJECTS[number]; index: number }> = ({ project, index }) => {
  const stagger = useStagger(index, 8, 5);
  return (
    <div style={stagger}>
      <MockCard glowColor={index === 0 ? colors.mauve : colors.surface1} style={index === 0 ? { border: `1px solid ${colors.mauve}50` } : {}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: colors.text, fontFamily: fonts.body }}>{project.name}</span>
          <span style={{ fontSize: 11, color: colors.subtext0, fontFamily: fonts.mono }}>{project.repo}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <MockBadge label={`${project.tickets} tickets`} color={colors.blue} />
          <span style={{ fontSize: 11, color: colors.green }}>✓ {project.shipped} shipped</span>
        </div>
      </MockCard>
    </div>
  );
};
