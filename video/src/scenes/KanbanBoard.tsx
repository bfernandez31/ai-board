import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts, stageColors } from '../theme';
import { MockColumn } from '../components/MockColumn';
import { MockTicket } from '../components/MockTicket';
import { useZoomIn, useStagger } from '../transitions';

const STAGES = [
  { key: 'INBOX', label: 'INBOX', color: stageColors.INBOX, count: 3 },
  { key: 'SPECIFY', label: 'SPECIFY', color: stageColors.SPECIFY, count: 2 },
  { key: 'PLAN', label: 'PLAN', color: stageColors.PLAN, count: 1 },
  { key: 'BUILD', label: 'BUILD', color: stageColors.BUILD, count: 2 },
  { key: 'VERIFY', label: 'VERIFY', color: stageColors.VERIFY, count: 1 },
  { key: 'SHIP', label: 'SHIP', color: stageColors.SHIP, count: 4 },
];

const SAMPLE_TICKETS: Record<string, { key: string; title: string }[]> = {
  INBOX: [
    { key: 'AIB-143', title: 'Add dark mode toggle' },
    { key: 'AIB-144', title: 'Fix notification delay' },
    { key: 'AIB-145', title: 'Optimize bundle size' },
  ],
  SPECIFY: [
    { key: 'AIB-141', title: 'User role permissions' },
    { key: 'AIB-142', title: 'Export analytics CSV' },
  ],
  PLAN: [{ key: 'AIB-140', title: 'Webhook integrations' }],
  BUILD: [
    { key: 'AIB-138', title: 'Real-time collaboration' },
    { key: 'AIB-139', title: 'Custom workflow stages' },
  ],
  VERIFY: [{ key: 'AIB-137', title: 'API rate limiting' }],
  SHIP: [
    { key: 'AIB-133', title: 'Search improvements' },
    { key: 'AIB-134', title: 'Audit log viewer' },
    { key: 'AIB-135', title: 'Bulk ticket actions' },
    { key: 'AIB-136', title: 'SSO integration' },
  ],
};

export const KanbanBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = useZoomIn(0);

  const newTicketOpacity = interpolate(frame, [40, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const newTicketScale = spring({ frame: frame - 40, fps, config: { damping: 80, stiffness: 200, mass: 0.5 }, durationInFrames: 15 });

  const dragProgress = interpolate(frame, [90, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const isDragging = frame >= 90 && frame <= 130;
  const dragDone = frame > 130;
  const dragX = interpolate(dragProgress, [0, 1], [0, 310]);
  const dragY = interpolate(dragProgress, [0, 0.5, 1], [0, -20, 0]);
  const dragRotate = interpolate(dragProgress, [0, 0.3, 0.7, 1], [0, -3, 2, 0]);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: '#000' }} />
      <AbsoluteFill style={{ padding: '40px 50px', opacity: zoom.opacity, transform: `scale(${zoom.scale})`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: fonts.display }}>ai-board</span>
          <span style={{ fontSize: 13, color: colors.subtext0 }}>Board</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flex: 1 }}>
          {STAGES.map((stage, colIdx) => (
            <StageColumnWrapper
              key={stage.key}
              stage={stage}
              colIdx={colIdx}
              frame={frame}
              isDragging={isDragging}
              dragDone={dragDone}
              newTicketOpacity={newTicketOpacity}
              newTicketScale={newTicketScale}
            />
          ))}
          {isDragging && (
            <div style={{ position: 'absolute', left: 60 + dragX, top: 106, transform: `translateY(${dragY}px) rotate(${dragRotate}deg)`, zIndex: 100, filter: `drop-shadow(0 8px 24px ${colors.mauve}40)` }}>
              <MockTicket ticketKey="AIB-146" title="Add landing page video" style={{ border: `1px solid ${colors.mauve}80`, width: 240 }} />
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Extracted to avoid hooks-in-loop violation
const StageColumnWrapper: React.FC<{
  stage: typeof STAGES[number];
  colIdx: number;
  frame: number;
  isDragging: boolean;
  dragDone: boolean;
  newTicketOpacity: number;
  newTicketScale: number;
}> = ({ stage, colIdx, frame, isDragging, dragDone, newTicketOpacity, newTicketScale }) => {
  const colStagger = useStagger(colIdx, 0, 3);
  const tickets = SAMPLE_TICKETS[stage.key] || [];

  // After drag: ticket moves from INBOX to SPECIFY
  const showNewTicketInInbox = stage.key === 'INBOX' && frame >= 40 && !dragDone;
  const showNewTicketInSpecify = stage.key === 'SPECIFY' && dragDone;

  return (
    <div style={{ ...colStagger, flex: 1, display: 'flex', flexDirection: 'column' as const }}>
      <MockColumn label={stage.label} color={stage.color} count={stage.key === 'INBOX' && frame >= 50 && !dragDone ? stage.count + 1 : stage.key === 'SPECIFY' && dragDone ? stage.count + 1 : stage.count}>
        {showNewTicketInInbox && (
          <div style={{ opacity: isDragging ? 0 : newTicketOpacity, transform: `scale(${interpolate(newTicketScale, [0, 1], [0.8, 1])})` }}>
            <MockTicket ticketKey="AIB-146" title="Add landing page video" style={{ border: `1px solid ${colors.mauve}50`, boxShadow: `0 0 16px ${colors.mauve}30` }} />
          </div>
        )}
        {showNewTicketInSpecify && (
          <MockTicket ticketKey="AIB-146" title="Add landing page video" style={{ border: `1px solid ${colors.lavender}50`, boxShadow: `0 0 16px ${colors.lavender}30` }} />
        )}
        {tickets.map((ticket) => (
          <MockTicket key={ticket.key} ticketKey={ticket.key} title={ticket.title} />
        ))}
      </MockColumn>
    </div>
  );
};
