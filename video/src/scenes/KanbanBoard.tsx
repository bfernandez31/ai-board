import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import { colors, fonts, stageColors } from '../theme';
import { MockColumn } from '../components/MockColumn';
import { MockTicket, type JobStatus } from '../components/MockTicket';
import { QualityZoom } from '../components/QualityZoom';
import { useZoomIn, useStagger } from '../transitions';

// 600 frames total (20s at 30fps)
// Act 1: Overview          (0-60)     2s  — Full board fades in
// Act 2: Human Drag        (60-180)   4s  — Camera zooms on INBOX/SPECIFY, drag ticket
// Act 3: AI Works          (180-330)  5s  — Camera zooms on BUILD/VERIFY, build completes, auto-slide
// Act 4: Quality Gate      (330-480)  5s  — QualityZoom overlay on top
// Act 5: Ship              (480-600)  4s  — Camera zooms out, ticket ships with glow

const STAGES = [
  { key: 'INBOX', label: 'INBOX', color: stageColors.INBOX },
  { key: 'SPECIFY', label: 'SPECIFY', color: stageColors.SPECIFY },
  { key: 'PLAN', label: 'PLAN', color: stageColors.PLAN },
  { key: 'BUILD', label: 'BUILD', color: stageColors.BUILD },
  { key: 'VERIFY', label: 'VERIFY', color: stageColors.VERIFY },
  { key: 'SHIP', label: 'SHIP', color: stageColors.SHIP },
];

// Tickets referenced in multiple acts — single source of truth
const HERO_TICKET = { key: 'AIB-142', title: 'API endpoints', qualityScore: 92 } as const;
const DRAG_TICKET = { key: 'AIB-147', title: 'Add dark mode toggle' } as const;

const COLUMN_STRIDE = 302; // column width (~290px) + gap (12px)
const BOARD_PAD_LEFT = 50;
const FLOATING_TICKET_TOP = 80;

const INITIAL_TICKETS: Record<
  string,
  { key: string; title: string; jobStatus?: JobStatus; qualityScore?: number }[]
> = {
  INBOX: [
    { key: DRAG_TICKET.key, title: DRAG_TICKET.title },
    { key: 'AIB-148', title: 'Fix notification delay' },
  ],
  SPECIFY: [
    { key: 'AIB-145', title: 'User role permissions', jobStatus: 'RUNNING' },
  ],
  PLAN: [
    { key: 'AIB-143', title: 'Webhook integrations', jobStatus: 'COMPLETED' },
  ],
  BUILD: [
    { key: HERO_TICKET.key, title: HERO_TICKET.title, jobStatus: 'RUNNING' },
  ],
  VERIFY: [
    { key: 'AIB-140', title: 'Rate limiting', jobStatus: 'COMPLETED', qualityScore: 94 },
  ],
  SHIP: [
    { key: 'AIB-136', title: 'SSO integration', jobStatus: 'COMPLETED', qualityScore: 91 },
    { key: 'AIB-135', title: 'Bulk ticket actions', jobStatus: 'COMPLETED', qualityScore: 88 },
  ],
};

// Camera keyframes: [frame, scale, translateX%, translateY%]
// We interpolate smoothly between these positions
const CAMERA_KEYFRAMES = {
  frames:     [0,   30,  60,   90,   180,  210,  330,  460,  490,  600],
  scale:      [0.85, 1.0, 1.0,  1.5,  1.5,  1.5,  1.5,  1.5,  1.0,  1.0],
  translateX: [0,    0,   0,    22,   22,   -22,  -22,  -32,  0,    0],
  translateY: [0,    0,   0,    18,   18,   18,   18,   18,   0,    0],
};

function useCamera(frame: number) {
  const { frames, scale, translateX, translateY } = CAMERA_KEYFRAMES;
  const s = interpolate(frame, frames, scale, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tx = interpolate(frame, frames, translateX, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ty = interpolate(frame, frames, translateY, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { scale: s, translateX: tx, translateY: ty };
}

export const KanbanBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const initialFade = useZoomIn(0);
  const camera = useCamera(frame);

  // --- Act 2: Human drag AIB-147 from INBOX to SPECIFY (frames 100-160) ---
  const dragStart = 100;
  const dragEnd = 160;
  const dragProgress = interpolate(frame, [dragStart, dragEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isDragging = frame >= dragStart && frame <= dragEnd;
  const dragDone = frame > dragEnd;

  const dragX = interpolate(dragProgress, [0, 1], [0, COLUMN_STRIDE]);
  const dragY = interpolate(dragProgress, [0, 0.5, 1], [0, -25, 0]);
  const dragRotate = interpolate(dragProgress, [0, 0.3, 0.7, 1], [0, -3, 2, 0]);

  // --- Act 3: AIB-142 completes BUILD (frame 240) and slides to VERIFY (frames 260-310) ---
  const buildCompleteFrame = 240;
  const slideStart = 260;
  const slideEnd = 310;
  const slideProgress = interpolate(frame, [slideStart, slideEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isSliding = frame >= slideStart && frame <= slideEnd;
  const slideDone = frame > slideEnd;

  const slideX = interpolate(slideProgress, [0, 1], [0, COLUMN_STRIDE]);
  const slideY = interpolate(slideProgress, [0, 0.5, 1], [0, -15, 0]);

  // --- Act 4: Quality Gate zoom (frames 350-460) ---
  const zoomActive = frame >= 350 && frame <= 460;

  // --- Act 5: AIB-142 slides from VERIFY to SHIP (frames 510-560) ---
  const shipStart = 510;
  const shipEnd = 560;
  const shipProgress = interpolate(frame, [shipStart, shipEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isShipping = frame >= shipStart && frame <= shipEnd;
  const shipDone = frame > shipEnd;

  const shipGlow = interpolate(frame, [shipEnd, shipEnd + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  function getColumnCount(stageKey: string): number {
    const base = (INITIAL_TICKETS[stageKey] || []).length;
    if (stageKey === 'INBOX') {
      return (isDragging || dragDone) ? base - 1 : base;
    }
    if (stageKey === 'SPECIFY') {
      return dragDone ? base + 1 : base;
    }
    if (stageKey === 'BUILD') {
      return (isSliding || slideDone) ? base - 1 : base;
    }
    if (stageKey === 'VERIFY') {
      if (isShipping || shipDone) return base;
      if (slideDone) return base + 1;
      return base;
    }
    if (stageKey === 'SHIP') {
      return shipDone ? base + 1 : base;
    }
    return base;
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: colors.crust }} />

      {/* Board container with camera transform */}
      <AbsoluteFill
        style={{
          padding: '40px 50px',
          opacity: initialFade.opacity,
          transform: `scale(${camera.scale}) translate(${camera.translateX}%, ${camera.translateY}%)`,
          transformOrigin: 'center center',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: fonts.display }}>
            ai-board
          </span>
          <span style={{ fontSize: 13, color: colors.subtext0 }}>Board</span>
        </div>

        {/* Columns */}
        <div style={{ display: 'flex', gap: 12, flex: 1, position: 'relative' }}>
          {STAGES.map((stage, colIdx) => (
            <ColumnWrapper
              key={stage.key}
              stage={stage}
              colIdx={colIdx}
              frame={frame}
              dragDone={dragDone}
              isDragging={isDragging}
              slideDone={slideDone}
              isSliding={isSliding}
              buildCompleteFrame={buildCompleteFrame}
              shipDone={shipDone}
              isShipping={isShipping}
              shipGlow={shipGlow}
              count={getColumnCount(stage.key)}
            />
          ))}

          {/* Dragging ticket (Act 2) */}
          {isDragging && (
            <div
              style={{
                position: 'absolute',
                left: BOARD_PAD_LEFT + dragX,
                top: FLOATING_TICKET_TOP,
                transform: `translateY(${dragY}px) rotate(${dragRotate}deg)`,
                zIndex: 100,
                filter: `drop-shadow(0 8px 24px ${colors.mauve}40)`,
              }}
            >
              <MockTicket ticketKey={DRAG_TICKET.key} title={DRAG_TICKET.title} style={{ width: 240 }} />
            </div>
          )}

          {/* Sliding ticket BUILD→VERIFY (Act 3) */}
          {isSliding && (
            <div
              style={{
                position: 'absolute',
                left: BOARD_PAD_LEFT + 3 * COLUMN_STRIDE + slideX,
                top: FLOATING_TICKET_TOP,
                transform: `translateY(${slideY}px)`,
                zIndex: 100,
                filter: `drop-shadow(0 8px 24px ${stageColors.BUILD}40)`,
              }}
            >
              <MockTicket
                ticketKey={HERO_TICKET.key}
                title={HERO_TICKET.title}
                jobStatus="COMPLETED"
                style={{ width: 240 }}
              />
            </div>
          )}

          {/* Shipping ticket VERIFY→SHIP (Act 5) */}
          {isShipping && (
            <div
              style={{
                position: 'absolute',
                left: BOARD_PAD_LEFT + 4 * COLUMN_STRIDE + shipProgress * COLUMN_STRIDE,
                top: FLOATING_TICKET_TOP,
                transform: `translateY(${interpolate(shipProgress, [0, 0.5, 1], [0, -15, 0])}px)`,
                zIndex: 100,
                filter: `drop-shadow(0 8px 24px ${stageColors.SHIP}40)`,
              }}
            >
              <MockTicket
                ticketKey={HERO_TICKET.key}
                title={HERO_TICKET.title}
                jobStatus="COMPLETED"
                qualityScore={HERO_TICKET.qualityScore}
                style={{ width: 240, boxShadow: `0 0 20px ${colors.green}30` }}
              />
            </div>
          )}
        </div>
      </AbsoluteFill>

      {/* Tooltip captions — outside the camera transform so they're always readable */}
      <CaptionTooltip text="You decide what to build, and when" delay={110} duration={65} />
      <CaptionTooltip text="You supervise, AI executes" delay={250} duration={70} />
      <CaptionTooltip text="Every ticket is evaluated before it ships" delay={340} duration={80} />

      {/* Act 4: Quality Gate zoom overlay */}
      {zoomActive && (
        <QualityZoom
          ticketKey={HERO_TICKET.key}
          title={HERO_TICKET.title}
          score={HERO_TICKET.qualityScore}
          delay={350}
        />
      )}
    </AbsoluteFill>
  );
};

/** Large caption tooltip centered at the bottom of the viewport */
const CaptionTooltip: React.FC<{ text: string; delay: number; duration: number }> = ({
  text,
  delay,
  duration,
}) => {
  const frame = useCurrentFrame();

  const enterProgress = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitProgress = interpolate(frame - delay, [duration - 12, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(enterProgress, exitProgress);
  const translateY = interpolate(enterProgress, [0, 1], [12, 0]);

  if (frame < delay || frame > delay + duration) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 90,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          background: `${colors.surface0}ee`,
          border: `1px solid ${colors.yellow}50`,
          borderLeft: `4px solid ${colors.yellow}`,
          borderRadius: 12,
          padding: '12px 24px',
          fontSize: 20,
          fontWeight: 600,
          color: colors.yellow,
          fontFamily: fonts.body,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 8px 32px ${colors.crust}aa`,
          maxWidth: 700,
          textAlign: 'center' as const,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const ColumnWrapper: React.FC<{
  stage: typeof STAGES[number];
  colIdx: number;
  frame: number;
  dragDone: boolean;
  isDragging: boolean;
  slideDone: boolean;
  isSliding: boolean;
  buildCompleteFrame: number;
  shipDone: boolean;
  isShipping: boolean;
  shipGlow: number;
  count: number;
}> = ({
  stage,
  colIdx,
  frame,
  dragDone,
  isDragging,
  slideDone,
  isSliding,
  buildCompleteFrame,
  shipDone,
  isShipping,
  shipGlow,
  count,
}) => {
  const colStagger = useStagger(colIdx, 0, 3);
  const tickets = INITIAL_TICKETS[stage.key] || [];

  return (
    <div style={{ ...colStagger, flex: 1, display: 'flex', flexDirection: 'column' as const }}>
      <MockColumn label={stage.label} color={stage.color} count={count}>
        {tickets.map((ticket) => {
          if (ticket.key === DRAG_TICKET.key && stage.key === 'INBOX' && (isDragging || dragDone)) {
            return null;
          }
          if (ticket.key === HERO_TICKET.key && stage.key === 'BUILD' && (isSliding || slideDone)) {
            return null;
          }
          if (ticket.key === HERO_TICKET.key && stage.key === 'VERIFY' && (isShipping || shipDone)) {
            return null;
          }

          let jobStatus = ticket.jobStatus;
          if (ticket.key === HERO_TICKET.key && stage.key === 'BUILD' && frame >= buildCompleteFrame) {
            jobStatus = 'COMPLETED';
          }

          return (
            <MockTicket
              key={ticket.key}
              ticketKey={ticket.key}
              title={ticket.title}
              jobStatus={jobStatus}
              qualityScore={ticket.qualityScore}
            />
          );
        })}

        {/* AIB-147 appears in SPECIFY after drag */}
        {stage.key === 'SPECIFY' && dragDone && (
          <MockTicket ticketKey={DRAG_TICKET.key} title={DRAG_TICKET.title} jobStatus="PENDING" />
        )}

        {/* AIB-142 appears in VERIFY after slide (before shipping) */}
        {stage.key === 'VERIFY' && slideDone && !isShipping && !shipDone && (
          <MockTicket
            ticketKey={HERO_TICKET.key}
            title={HERO_TICKET.title}
            jobStatus={frame >= 340 ? 'COMPLETED' : frame >= 320 ? 'RUNNING' : 'PENDING'}
            qualityScore={frame >= 345 ? HERO_TICKET.qualityScore : undefined}
            style={frame >= 345 ? { boxShadow: `0 0 12px ${colors.green}30` } : undefined}
          />
        )}

        {/* AIB-142 appears in SHIP after shipping */}
        {stage.key === 'SHIP' && shipDone && (
          <MockTicket
            ticketKey={HERO_TICKET.key}
            title={HERO_TICKET.title}
            jobStatus="COMPLETED"
            qualityScore={HERO_TICKET.qualityScore}
            style={{
              boxShadow: `0 0 ${20 * shipGlow}px ${colors.green}${Math.round(shipGlow * 40).toString(16).padStart(2, '0')}`,
            }}
          />
        )}
      </MockColumn>
    </div>
  );
};
