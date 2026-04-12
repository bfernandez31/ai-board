# Landing Video Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the landing page demo video from 9 scenes to 5 focused scenes with a "wow" narrative, and enhance the video player with aurora-themed effects.

**Architecture:** Remotion video project (`video/src/`) for content changes — update theme timings, rewrite/create scene components, delete unused scenes. Landing page (`components/landing/video-section.tsx` + `app/globals.css`) for player visual treatment. No new dependencies.

**Tech Stack:** Remotion 4.x, React 18, TypeScript, Tailwind CSS, Catppuccin Mocha palette

**Spec:** `docs/superpowers/specs/2026-04-12-landing-video-redesign.md`

---

## File Structure

### Modified files
- `video/src/theme.ts` — Update SCENES timing for 5 scenes (was 9), update TOTAL_FRAMES
- `video/src/Video.tsx` — Update scene sequence to 5 scenes
- `video/src/scenes/Intro.tsx` — Change subtitle text
- `video/src/scenes/Dashboard.tsx` — Reduce to 4 projects, update metrics
- `video/src/scenes/KanbanBoard.tsx` — Full rewrite: 5-act narrative with tooltips, zoom, auto-transitions
- `video/src/scenes/HealthDashboard.tsx` — Rename to ResultsHealth, merge analytics metrics, remove heatmap/sparklines
- `video/src/scenes/Outro.tsx` — Change heading text
- `video/src/components/MockTicket.tsx` — Add `jobStatus` and `qualityScore` props
- `components/landing/video-section.tsx` — Add gradient border, glow pulse, enhanced scroll entry
- `app/globals.css` — Add video glow pulse keyframe, video entry animation class

### New files
- `video/src/components/Tooltip.tsx` — Animated tooltip bubble for Kanban scene
- `video/src/components/QualityZoom.tsx` — Quality gate detail modal with dimension breakdown

### Deleted files
- `video/src/scenes/WorkflowFlow.tsx`
- `video/src/scenes/TicketDetail.tsx`
- `video/src/scenes/Analytics.tsx`
- `video/src/scenes/Comparisons.tsx`

---

### Task 1: Update theme timing for 5 scenes

**Files:**
- Modify: `video/src/theme.ts`

- [ ] **Step 1: Update SCENES and TOTAL_FRAMES in theme.ts**

Replace the `VIDEO` and `SCENES` config with the new 5-scene timing:

```ts
export const VIDEO = {
  WIDTH: 1920,
  HEIGHT: 1080,
  FPS: 30,
  TOTAL_FRAMES: 1020,
} as const;

export const SCENES = {
  INTRO:     { from: 0,   duration: 120 },  // 4s
  DASHBOARD: { from: 120, duration: 120 },  // 4s
  KANBAN:    { from: 240, duration: 420 },  // 14s
  RESULTS:   { from: 660, duration: 240 },  // 8s
  OUTRO:     { from: 900, duration: 120 },  // 4s
} as const;
```

Total: 1020 frames = 34s at 30 FPS.

- [ ] **Step 2: Verify in Remotion Studio**

```bash
cd video && npx remotion studio
```

Expected: Studio opens, timeline shows 34s duration. No render errors.

- [ ] **Step 3: Commit**

```bash
git add video/src/theme.ts
git commit -m "refactor(video): update scene timings for 5-scene structure (34s)"
```

---

### Task 2: Update Video.tsx scene sequence

**Files:**
- Modify: `video/src/Video.tsx`

- [ ] **Step 1: Update imports and Sequence layout**

Replace the full content of `Video.tsx`:

```tsx
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { colors, SCENES } from './theme';
import { Intro } from './scenes/Intro';
import { Dashboard } from './scenes/Dashboard';
import { KanbanBoard } from './scenes/KanbanBoard';
import { ResultsHealth } from './scenes/ResultsHealth';
import { Outro } from './scenes/Outro';

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.base }}>
      <Sequence from={SCENES.INTRO.from} durationInFrames={SCENES.INTRO.duration}>
        <Intro />
      </Sequence>
      <Sequence from={SCENES.DASHBOARD.from} durationInFrames={SCENES.DASHBOARD.duration}>
        <Dashboard />
      </Sequence>
      <Sequence from={SCENES.KANBAN.from} durationInFrames={SCENES.KANBAN.duration}>
        <KanbanBoard />
      </Sequence>
      <Sequence from={SCENES.RESULTS.from} durationInFrames={SCENES.RESULTS.duration}>
        <ResultsHealth />
      </Sequence>
      <Sequence from={SCENES.OUTRO.from} durationInFrames={SCENES.OUTRO.duration}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Update index.ts if it references TOTAL_FRAMES**

Check `video/src/index.ts` — update `durationInFrames` to use `VIDEO.TOTAL_FRAMES` (1020).

- [ ] **Step 3: Commit**

```bash
git add video/src/Video.tsx video/src/index.ts
git commit -m "refactor(video): update Video.tsx to 5-scene sequence"
```

---

### Task 3: Delete removed scene files

**Files:**
- Delete: `video/src/scenes/WorkflowFlow.tsx`
- Delete: `video/src/scenes/TicketDetail.tsx`
- Delete: `video/src/scenes/Analytics.tsx`
- Delete: `video/src/scenes/Comparisons.tsx`

- [ ] **Step 1: Delete the 4 unused scene files**

```bash
cd /Users/b.fernandez/Workspace/ai-board
rm video/src/scenes/WorkflowFlow.tsx video/src/scenes/TicketDetail.tsx video/src/scenes/Analytics.tsx video/src/scenes/Comparisons.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Search for any remaining imports of these deleted files across the `video/` directory. The only file that imported them was `Video.tsx` which was updated in Task 2.

- [ ] **Step 3: Commit**

```bash
git add -u video/src/scenes/
git commit -m "chore(video): delete removed scenes (WorkflowFlow, TicketDetail, Analytics, Comparisons)"
```

---

### Task 4: Update MockTicket with job status and quality score

**Files:**
- Modify: `video/src/components/MockTicket.tsx`

- [ ] **Step 1: Add jobStatus and qualityScore props**

Replace the full content of `MockTicket.tsx`:

```tsx
import React from 'react';
import { colors, fonts } from '../theme';

type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

const JOB_STATUS_CONFIG: Record<JobStatus, { icon: string; color: string }> = {
  PENDING: { icon: '🕐', color: colors.overlay0 },
  RUNNING: { icon: '✏️', color: colors.blue },
  COMPLETED: { icon: '✅', color: colors.green },
  FAILED: { icon: '❌', color: colors.red },
};

function scoreColor(score: number): string {
  if (score >= 90) return colors.green;
  if (score >= 70) return colors.blue;
  if (score >= 50) return colors.yellow;
  return colors.red;
}

export const MockTicket: React.FC<{
  ticketKey: string;
  title: string;
  jobStatus?: JobStatus;
  qualityScore?: number;
  style?: React.CSSProperties;
}> = ({ ticketKey, title, jobStatus, qualityScore, style }) => {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colors.surface0}cc, ${colors.mantle}ee)`,
        border: `1px solid ${colors.surface1}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.subtext0 }}>
          {ticketKey}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {qualityScore !== undefined && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: scoreColor(qualityScore),
                background: `${scoreColor(qualityScore)}20`,
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: fonts.mono,
              }}
            >
              {qualityScore}
            </span>
          )}
          {jobStatus && (
            <span
              style={{
                fontSize: 12,
                filter: jobStatus === 'RUNNING' ? `drop-shadow(0 0 4px ${colors.blue})` : undefined,
              }}
            >
              {JOB_STATUS_CONFIG[jobStatus].icon}
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, lineHeight: 1.3 }}>
        {title}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Verify in Remotion Studio**

Open Studio, check existing scenes still render (Intro, Dashboard use MockTicket indirectly through the Kanban scene which will be rewritten later — but Dashboard doesn't use MockTicket, so no regression).

- [ ] **Step 3: Commit**

```bash
git add video/src/components/MockTicket.tsx
git commit -m "feat(video): add jobStatus and qualityScore props to MockTicket"
```

---

### Task 5: Create Tooltip component

**Files:**
- Create: `video/src/components/Tooltip.tsx`

- [ ] **Step 1: Create the animated tooltip bubble**

```tsx
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts } from '../theme';

export const Tooltip: React.FC<{
  text: string;
  delay: number;
  duration?: number;
  position?: 'top' | 'bottom';
  color?: string;
  style?: React.CSSProperties;
}> = ({ text, delay, duration = 60, position = 'top', color = colors.yellow, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 70, stiffness: 180, mass: 0.5 },
    durationInFrames: 15,
  });

  const exitProgress = interpolate(frame - delay, [duration - 10, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = Math.min(enterProgress, exitProgress);
  const translateY = position === 'top'
    ? interpolate(enterProgress, [0, 1], [-8, 0])
    : interpolate(enterProgress, [0, 1], [8, 0]);

  if (frame < delay || frame > delay + duration) return null;

  return (
    <div
      style={{
        position: 'absolute',
        [position === 'top' ? 'bottom' : 'top']: '100%',
        left: '50%',
        transform: `translateX(-50%) translateY(${translateY}px)`,
        opacity,
        whiteSpace: 'nowrap',
        zIndex: 50,
        marginBottom: position === 'top' ? 8 : 0,
        marginTop: position === 'bottom' ? 8 : 0,
        ...style,
      }}
    >
      <div
        style={{
          background: `${colors.surface0}ee`,
          border: `1px solid ${color}60`,
          borderLeft: `3px solid ${color}`,
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 13,
          color,
          fontFamily: fonts.body,
          fontWeight: 500,
          backdropFilter: 'blur(8px)',
          boxShadow: `0 4px 16px ${colors.crust}80`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/components/Tooltip.tsx
git commit -m "feat(video): add animated Tooltip component for Kanban scene"
```

---

### Task 6: Create QualityZoom component

**Files:**
- Create: `video/src/components/QualityZoom.tsx`

- [ ] **Step 1: Create the quality gate detail view**

This component renders the zoomed-in quality score modal with dimension breakdown — matching the real `QualityScoreSection` from the app.

```tsx
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts } from '../theme';
import { MockCard } from './MockCard';

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

  const scoreColor = score >= 90 ? colors.green : score >= 70 ? colors.blue : colors.yellow;

  // Score circle animation
  const scoreProgress = interpolate(frame - delay, [5, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentScore = Math.round(score * scoreProgress);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - (score / 100) * scoreProgress);

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
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `${colors.crust}cc`,
          backdropFilter: 'blur(8px)',
        }}
      />

      <MockCard
        glowColor={scoreColor}
        style={{
          position: 'relative',
          padding: 36,
          width: 700,
          border: `1px solid ${scoreColor}40`,
          boxShadow: `0 0 40px ${scoreColor}20`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          {/* Score circle */}
          <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
            <svg width={160} height={160}>
              <circle cx={80} cy={80} r={radius} fill="none" stroke={colors.surface1} strokeWidth={8} />
              <circle
                cx={80}
                cy={80}
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 80 80)"
                style={{ filter: `drop-shadow(0 0 10px ${scoreColor}60)` }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 44, fontWeight: 700, color: colors.text, fontFamily: fonts.display }}>
                {currentScore}
              </span>
              <span style={{ fontSize: 12, color: colors.subtext0, fontFamily: fonts.body }}>/100</span>
            </div>
          </div>

          {/* Details */}
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
                color: scoreColor,
                background: `${scoreColor}20`,
                padding: '3px 10px',
                borderRadius: 6,
                marginBottom: 20,
              }}
            >
              Excellent
            </span>

            {/* Dimension bars */}
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
```

- [ ] **Step 2: Commit**

```bash
git add video/src/components/QualityZoom.tsx
git commit -m "feat(video): add QualityZoom component for quality gate detail view"
```

---

### Task 7: Update Intro scene

**Files:**
- Modify: `video/src/scenes/Intro.tsx`

- [ ] **Step 1: Change the subtitle text**

In `Intro.tsx`, replace the subtitle span content:

Old:
```tsx
            We handle the rest.
```

New:
```tsx
            Specified. Planned. Built. Verified. Automatically.
```

That's the only change — the typewriter ("Write a ticket..."), logo, and aurora background stay as-is.

- [ ] **Step 2: Verify in Remotion Studio**

Check Intro scene renders with new subtitle text, gradient still applies, timing is correct within 120 frames.

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/Intro.tsx
git commit -m "feat(video): update Intro subtitle to emphasize reliability workflow"
```

---

### Task 8: Update Dashboard scene

**Files:**
- Modify: `video/src/scenes/Dashboard.tsx`

- [ ] **Step 1: Reduce to 4 projects and update metrics**

Replace the full content of `Dashboard.tsx`:

```tsx
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
];

export const Dashboard: React.FC = () => {
  const zoom = useZoomIn(0);
  const shippedCount = useCounter(138, 10, 35);
  const successRate = useCounter(94, 10, 35);

  return (
    <AbsoluteFill>
      <AuroraBackground />
      <AbsoluteFill style={{ padding: 80, opacity: zoom.opacity, transform: `scale(${zoom.scale})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: colors.text, fontFamily: fonts.display, margin: 0 }}>Projects</h1>
            <span style={{ fontSize: 14, color: colors.subtext0, fontFamily: fonts.body }}>4 projects</span>
          </div>
          <MockCard style={{ padding: '12px 24px', display: 'flex', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: colors.green, fontFamily: fonts.mono }}>{shippedCount}</span>
              <span style={{ fontSize: 11, color: colors.subtext0 }}>shipped</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: colors.green, fontFamily: fonts.mono }}>{successRate}%</span>
              <span style={{ fontSize: 11, color: colors.subtext0 }}>success rate</span>
            </div>
          </MockCard>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {PROJECTS.map((project, i) => (
            <StaggeredCard key={project.name} project={project} index={i} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

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
```

Changes: 4 projects (2×2 grid), "shipped" + "success rate" metrics instead of "tickets" + "pass rate".

- [ ] **Step 2: Verify in Remotion Studio**

Check Dashboard renders as 2×2 grid with correct metrics.

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/Dashboard.tsx
git commit -m "feat(video): reduce Dashboard to 4 projects with shipped/success metrics"
```

---

### Task 9: Rewrite KanbanBoard scene (hero scene)

**Files:**
- Modify: `video/src/scenes/KanbanBoard.tsx`

This is the largest task — full rewrite of the Kanban scene with 5 acts across 420 frames (14s).

- [ ] **Step 1: Rewrite KanbanBoard.tsx**

Replace the full content with the 5-act narrative scene:

```tsx
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { colors, fonts, stageColors } from '../theme';
import { MockColumn } from '../components/MockColumn';
import { MockTicket } from '../components/MockTicket';
import { Tooltip } from '../components/Tooltip';
import { QualityZoom } from '../components/QualityZoom';
import { useZoomIn, useStagger } from '../transitions';

// 420 frames total (14s at 30fps)
// Act 1: Living Board     (0-90)    3s
// Act 2: Human Drag       (90-150)  2s
// Act 3: AI Works         (150-240) 3s
// Act 4: Quality Gate     (240-330) 3s
// Act 5: Ship             (330-420) 3s

const STAGES = [
  { key: 'INBOX', label: 'INBOX', color: stageColors.INBOX },
  { key: 'SPECIFY', label: 'SPECIFY', color: stageColors.SPECIFY },
  { key: 'PLAN', label: 'PLAN', color: stageColors.PLAN },
  { key: 'BUILD', label: 'BUILD', color: stageColors.BUILD },
  { key: 'VERIFY', label: 'VERIFY', color: stageColors.VERIFY },
  { key: 'SHIP', label: 'SHIP', color: stageColors.SHIP },
];

// Tickets in their initial positions with realistic states
const INITIAL_TICKETS: Record<
  string,
  { key: string; title: string; jobStatus?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'; qualityScore?: number }[]
> = {
  INBOX: [
    { key: 'AIB-147', title: 'Add dark mode toggle' },
    { key: 'AIB-148', title: 'Fix notification delay' },
  ],
  SPECIFY: [
    { key: 'AIB-145', title: 'User role permissions', jobStatus: 'RUNNING' },
  ],
  PLAN: [
    { key: 'AIB-143', title: 'Webhook integrations', jobStatus: 'COMPLETED' },
  ],
  BUILD: [
    { key: 'AIB-142', title: 'API endpoints', jobStatus: 'RUNNING' },
  ],
  VERIFY: [
    { key: 'AIB-140', title: 'Rate limiting', jobStatus: 'COMPLETED', qualityScore: 94 },
  ],
  SHIP: [
    { key: 'AIB-136', title: 'SSO integration', jobStatus: 'COMPLETED', qualityScore: 91 },
    { key: 'AIB-135', title: 'Bulk ticket actions', jobStatus: 'COMPLETED', qualityScore: 88 },
  ],
};

export const KanbanBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = useZoomIn(0);

  // --- Act 2: Human drag AIB-147 from INBOX to SPECIFY (frames 90-140) ---
  const dragStart = 90;
  const dragEnd = 140;
  const dragProgress = interpolate(frame, [dragStart, dragEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isDragging = frame >= dragStart && frame <= dragEnd;
  const dragDone = frame > dragEnd;

  // Column positions: each column ~290px wide with 12px gaps, starting at 50px padding
  const dragX = interpolate(dragProgress, [0, 1], [0, 302]); // INBOX to SPECIFY
  const dragY = interpolate(dragProgress, [0, 0.5, 1], [0, -25, 0]);
  const dragRotate = interpolate(dragProgress, [0, 0.3, 0.7, 1], [0, -3, 2, 0]);

  // --- Act 3: AIB-142 completes BUILD (frame 170) and slides to VERIFY (frames 180-220) ---
  const buildCompleteFrame = 170;
  const slideStart = 180;
  const slideEnd = 220;
  const slideProgress = interpolate(frame, [slideStart, slideEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isSliding = frame >= slideStart && frame <= slideEnd;
  const slideDone = frame > slideEnd;

  const slideX = interpolate(slideProgress, [0, 1], [0, 302]); // BUILD to VERIFY
  const slideY = interpolate(slideProgress, [0, 0.5, 1], [0, -15, 0]);

  // --- Act 4: Quality Gate zoom (frames 260-330) ---
  const zoomActive = frame >= 260 && frame <= 330;

  // --- Act 5: AIB-142 slides from VERIFY to SHIP (frames 345-385) ---
  const shipStart = 345;
  const shipEnd = 385;
  const shipProgress = interpolate(frame, [shipStart, shipEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isShipping = frame >= shipStart && frame <= shipEnd;
  const shipDone = frame > shipEnd;

  const shipX = interpolate(shipProgress, [0, 1], [0, 302]); // VERIFY to SHIP
  const shipGlow = interpolate(frame, [shipEnd, shipEnd + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Determine dynamic ticket counts per column
  function getColumnCount(stageKey: string): number {
    const base = (INITIAL_TICKETS[stageKey] || []).length;
    if (stageKey === 'INBOX') {
      // AIB-147 leaves after drag
      return dragDone ? base - 1 : base;
    }
    if (stageKey === 'SPECIFY') {
      // AIB-147 arrives after drag
      return dragDone ? base + 1 : base;
    }
    if (stageKey === 'BUILD') {
      // AIB-142 leaves after slide
      return slideDone ? base - 1 : base;
    }
    if (stageKey === 'VERIFY') {
      // AIB-142 arrives after slide, leaves after ship
      if (shipDone) return base; // AIB-142 left to SHIP
      if (slideDone) return base + 1; // AIB-142 arrived
      return base;
    }
    if (stageKey === 'SHIP') {
      // AIB-142 arrives after ship
      return shipDone ? base + 1 : base;
    }
    return base;
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: colors.crust }} />
      <AbsoluteFill
        style={{
          padding: '40px 50px',
          opacity: zoom.opacity,
          transform: `scale(${zoom.scale})`,
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
                left: 50 + dragX,
                top: 80,
                transform: `translateY(${dragY}px) rotate(${dragRotate}deg)`,
                zIndex: 100,
                filter: `drop-shadow(0 8px 24px ${colors.mauve}40)`,
              }}
            >
              <MockTicket ticketKey="AIB-147" title="Add dark mode toggle" style={{ width: 240 }} />
            </div>
          )}

          {/* Sliding ticket BUILD→VERIFY (Act 3) */}
          {isSliding && (
            <div
              style={{
                position: 'absolute',
                left: 50 + 3 * 302 + slideX,
                top: 80,
                transform: `translateY(${slideY}px)`,
                zIndex: 100,
                filter: `drop-shadow(0 8px 24px ${stageColors.BUILD}40)`,
              }}
            >
              <MockTicket
                ticketKey="AIB-142"
                title="API endpoints"
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
                left: 50 + 4 * 302 + shipX,
                top: 80,
                transform: `translateY(${interpolate(shipProgress, [0, 0.5, 1], [0, -15, 0])}px)`,
                zIndex: 100,
                filter: `drop-shadow(0 8px 24px ${stageColors.SHIP}40)`,
              }}
            >
              <MockTicket
                ticketKey="AIB-142"
                title="API endpoints"
                jobStatus="COMPLETED"
                qualityScore={92}
                style={{ width: 240, boxShadow: `0 0 20px ${colors.green}30` }}
              />
            </div>
          )}
        </div>

        {/* Tooltip bubbles */}
        <div style={{ position: 'absolute', top: 50, right: 60 }}>
          <Tooltip text='You decide what to build, and when' delay={100} duration={50} position="bottom" />
          <Tooltip text='You supervise, AI executes' delay={190} duration={50} position="bottom" />
          <Tooltip text='Every ticket is evaluated before it ships' delay={260} duration={60} position="bottom" />
        </div>
      </AbsoluteFill>

      {/* Act 4: Quality Gate zoom overlay */}
      {zoomActive && (
        <QualityZoom
          ticketKey="AIB-142"
          title="API endpoints"
          score={92}
          delay={260}
        />
      )}
    </AbsoluteFill>
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
          // Hide AIB-147 from INBOX when dragging or done
          if (ticket.key === 'AIB-147' && stage.key === 'INBOX' && (isDragging || dragDone)) {
            return null;
          }
          // Hide AIB-142 from BUILD when sliding or done
          if (ticket.key === 'AIB-142' && stage.key === 'BUILD' && (isSliding || slideDone)) {
            return null;
          }
          // Hide AIB-142 from VERIFY when shipping or done
          if (ticket.key === 'AIB-142' && stage.key === 'VERIFY' && (isShipping || shipDone)) {
            return null;
          }

          // AIB-142 in BUILD: update jobStatus when build completes
          let jobStatus = ticket.jobStatus;
          if (ticket.key === 'AIB-142' && stage.key === 'BUILD' && frame >= buildCompleteFrame) {
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
          <MockTicket ticketKey="AIB-147" title="Add dark mode toggle" jobStatus="PENDING" />
        )}

        {/* AIB-142 appears in VERIFY after slide (before shipping) */}
        {stage.key === 'VERIFY' && slideDone && !isShipping && !shipDone && (
          <MockTicket
            ticketKey="AIB-142"
            title="API endpoints"
            jobStatus={frame >= 250 ? 'COMPLETED' : frame >= 230 ? 'RUNNING' : 'PENDING'}
            qualityScore={frame >= 255 ? 92 : undefined}
            style={frame >= 255 ? { boxShadow: `0 0 12px ${colors.green}30` } : undefined}
          />
        )}

        {/* AIB-142 appears in SHIP after shipping */}
        {stage.key === 'SHIP' && shipDone && (
          <MockTicket
            ticketKey="AIB-142"
            title="API endpoints"
            jobStatus="COMPLETED"
            qualityScore={92}
            style={{
              boxShadow: `0 0 ${20 * shipGlow}px ${colors.green}${Math.round(shipGlow * 40).toString(16).padStart(2, '0')}`,
            }}
          />
        )}
      </MockColumn>
    </div>
  );
};
```

- [ ] **Step 2: Verify in Remotion Studio**

Open Studio, scrub through the Kanban scene (frames 240-660 in the full timeline, 0-420 within the scene). Verify:
- Act 1: Board appears with tickets in all columns, job status icons visible
- Act 2: AIB-147 drags from INBOX to SPECIFY, tooltip appears
- Act 3: AIB-142 completes (icon change), slides to VERIFY, tooltip appears
- Act 4: Quality zoom overlay appears with score circle + dimension bars
- Act 5: AIB-142 slides to SHIP with glow

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/KanbanBoard.tsx
git commit -m "feat(video): rewrite KanbanBoard as 5-act narrative hero scene"
```

---

### Task 10: Create ResultsHealth scene

**Files:**
- Create: `video/src/scenes/ResultsHealth.tsx` (replaces HealthDashboard.tsx)
- Delete: `video/src/scenes/HealthDashboard.tsx`

- [ ] **Step 1: Create ResultsHealth.tsx**

```tsx
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
          {/* Left: Key metrics + Health score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            {/* Metrics cards */}
            <div style={{ display: 'flex', gap: 16 }}>
              <MetricCard label="Shipped" value={shippedCount} color={colors.green} icon="🚀" index={0} />
              <MetricCard label="Success Rate" value={`${successRate}%`} color={colors.green} icon="✓" index={1} />
            </div>

            {/* Health score circle */}
            <MockCard style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <ScoreCircle score={94} size={180} color={colors.green} delay={12} />
              <span style={{ fontSize: 18, fontWeight: 600, color: colors.green, fontFamily: fonts.body }}>
                Excellent
              </span>
              <span style={{ fontSize: 12, color: colors.subtext0 }}>Overall health score</span>
            </MockCard>
          </div>

          {/* Right: Module cards */}
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
```

- [ ] **Step 2: Delete the old HealthDashboard.tsx**

```bash
rm video/src/scenes/HealthDashboard.tsx
```

- [ ] **Step 3: Verify in Remotion Studio**

Check Results scene shows: 2 metric cards (shipped + success rate), health score circle (94), 4 module cards in 2×2 grid. No heatmap, no sparklines.

- [ ] **Step 4: Commit**

```bash
git add video/src/scenes/ResultsHealth.tsx
git add -u video/src/scenes/HealthDashboard.tsx
git commit -m "feat(video): create ResultsHealth scene merging analytics metrics + health"
```

---

### Task 11: Update Outro scene

**Files:**
- Modify: `video/src/scenes/Outro.tsx`

- [ ] **Step 1: Update the heading text**

In `Outro.tsx`, replace the heading span content:

Old:
```tsx
          From ticket to production.
```

New:
```tsx
          Built by AI. Verified by standards. Approved by you.
```

That's the only change — the typewriter ("Automatically."), CTA button, and fade-to-black all stay.

- [ ] **Step 2: Verify in Remotion Studio**

Check Outro scene renders new heading, typewriter still works, CTA appears at frame 70.

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/Outro.tsx
git commit -m "feat(video): update Outro heading to reliability-focused message"
```

---

### Task 12: Enhance VideoSection with aurora effects

**Files:**
- Modify: `app/globals.css`
- Modify: `components/landing/video-section.tsx`

- [ ] **Step 1: Add video glow and entry animations to globals.css**

Add after the existing `animate-gradient-border` block (around line 198):

```css
  /* Video player glow pulse */
  .video-glow-pulse {
    animation: video-glow 3s ease-in-out infinite;
  }

  @keyframes video-glow {
    0%, 100% {
      box-shadow:
        0 0 30px hsl(var(--ctp-mauve) / 0.1),
        0 0 60px hsl(var(--ctp-blue) / 0.05);
    }
    50% {
      box-shadow:
        0 0 40px hsl(var(--ctp-mauve) / 0.18),
        0 0 80px hsl(var(--ctp-blue) / 0.1);
    }
  }

  /* Video section enhanced entry */
  .landing-fade-in-video {
    opacity: 0;
    transform: translateY(32px) scale(0.95);
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .landing-fade-in-video.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .video-glow-pulse {
      animation: none;
    }
    .landing-fade-in-video {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
```

- [ ] **Step 2: Update video-section.tsx with aurora gradient border and glow**

Replace the full content of `video-section.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const VIDEO_URL = '/videos/ai-board-demo';

export function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          video.play().catch(() => {
            // Autoplay blocked — user needs to interact
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <section
      id="demo"
      className="scroll-mt-20 py-16 md:py-24"
      aria-label="Product demo video"
    >
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            See it in action
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            From ticket to production — automatically
          </p>
        </div>

        <div
          ref={containerRef}
          className={`group relative overflow-hidden rounded-2xl border border-ctp-mauve/30 ${
            isPlaying ? 'video-glow-pulse' : ''
          }`}
          style={{
            backgroundImage: 'linear-gradient(135deg, hsl(var(--ctp-blue) / 0.2), hsl(var(--ctp-mauve) / 0.2), hsl(var(--ctp-pink) / 0.2))',
            backgroundSize: '100% 200%',
            animation: 'gradient-shift 4s ease-in-out infinite',
            padding: '1px',
          }}
        >
          <div className="overflow-hidden rounded-2xl">
            <video
              ref={videoRef}
              className="w-full"
              muted
              loop
              playsInline
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={`${VIDEO_URL}.mp4`} type="video/mp4" />
            </video>
          </div>

          {/* Minimal controls overlay */}
          <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlay}
              className="rounded-lg bg-ctp-surface0/80 text-xs text-foreground backdrop-blur-sm hover:bg-ctp-surface1/80"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? '⏸' : '▶'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="rounded-lg bg-ctp-surface0/80 text-xs text-foreground backdrop-blur-sm hover:bg-ctp-surface1/80"
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            >
              {isMuted ? '🔇' : '🔊'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
```

Key changes:
- Gradient border using `padding: 1px` trick with gradient background (reuses `gradient-shift` keyframe)
- `border-ctp-mauve/30` for subtle aurora-tinted border
- `video-glow-pulse` class toggled by `isPlaying` state
- Inner `rounded-2xl` div clips the video content inside the gradient border
- Subtitle text updated to match narrative

- [ ] **Step 3: Update FadeInSection for video entry**

The existing `landing-fade-in` class already applies `scale(0.98)` + fade. The spec wants a slightly more dramatic `scale(0.95)` for the video. In `app/landing/page.tsx`, find the `<FadeInSection>` wrapping `<VideoSection />` and add an inline style override on a wrapper div:

```tsx
<FadeInSection>
  <div className="landing-fade-in-video">
    <VideoSection />
  </div>
</FadeInSection>
```

The `landing-fade-in-video` class (added in Step 1) handles the `scale(0.95)` entry. The parent `FadeInSection` triggers the `.visible` class via IntersectionObserver. Add the `.visible` selector support to `landing-fade-in-video` so it responds to the parent's class toggle. This is already done in the CSS from Step 1.

- [ ] **Step 4: Verify in browser**

```bash
bun run dev
```

Open `http://localhost:3000`, scroll to the video section. Verify:
- Gradient border animates (blue→violet→pink rotation)
- Glow pulses when video is playing
- Video emerges with scale(0.95→1) on scroll
- Controls still work on hover

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/landing/video-section.tsx
git commit -m "feat(landing): add aurora gradient border and glow pulse to video player"
```

---

### Task 13: Build and deploy video

**Files:**
- Render output: `video/out/ai-board-demo.mp4`
- Copy to: `public/videos/ai-board-demo.mp4`

- [ ] **Step 1: Render the video**

```bash
cd /Users/b.fernandez/Workspace/ai-board/video
bun run build
```

Expected: Renders to `video/out/ai-board-demo.mp4`, ~34 seconds, 1920×1080.

- [ ] **Step 2: Copy to public directory**

```bash
cp video/out/ai-board-demo.mp4 public/videos/ai-board-demo.mp4
```

- [ ] **Step 3: Verify in browser**

```bash
bun run dev
```

Open `http://localhost:3000`, check:
- Video plays with new 5-scene content
- All 5 acts of Kanban scene visible
- Quality gate zoom renders correctly
- Aurora effects on player work
- Total duration ~34s

- [ ] **Step 4: Commit**

```bash
git add public/videos/ai-board-demo.mp4
git commit -m "build(video): render updated 5-scene demo video (34s)"
```

---

### Task 14: Final cleanup and type-check

- [ ] **Step 1: Run type-check and lint**

```bash
cd /Users/b.fernandez/Workspace/ai-board
bun run type-check
bun run lint
```

Fix any errors.

- [ ] **Step 2: Verify no orphan imports**

Search for any references to deleted scenes or old component props:

```bash
grep -r "WorkflowFlow\|TicketDetail\|Analytics\|Comparisons" video/src/
grep -r "stage=\|cost=" video/src/
```

Expected: No results (old props removed from MockTicket).

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "chore: cleanup orphan references and fix type errors"
```
