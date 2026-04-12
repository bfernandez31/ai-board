# Landing Page Video Redesign

## Overview

Redesign the landing page demo video (content + visual treatment) to create a "wow" effect. Two axes: rework the Remotion video content from 9 scenes to 5 focused scenes, and enhance the video player presentation with aurora-themed effects.

## Target Audience

Dual audience:
- **Primary (REX context)**: Developers — focus on "human on the loop" concept with evaluation and quality gates
- **Commercial angle**: Product owners / non-technical — focus on simplicity ("write what you want, everything happens automatically")

The narrative should work for both: start with simplicity (PO-friendly) then show control mechanisms (dev-friendly).

## Core Message

**Reliability over speed/cost.** The video should communicate that AI-generated code is specified, planned, built, tested, and verified — not that it's cheap or fast.

## Video Content — 5 Scenes (~34s total)

### Scene 1: Intro (~4s)

- **Keep**: Logo "ai-board", typewriter animation, aurora background
- **Change subtitle**: From "We handle the rest." to **"Specified. Planned. Built. Verified. Automatically."**
- Announces the workflow stages without being technical
- Same animation patterns: logo fade-in, typewriter, subtitle slide-in

### Scene 2: Dashboard (~4s)

- **Reduce to 4 projects** (2×2 grid) for readability at 4s duration
- **Metrics**: Tickets shipped + success rate (counter animations)
- Remove: 3×2 grid of 6 projects (too dense), token-related stats
- Purpose: quickly establish "this runs across multiple projects"

### Scene 3: Kanban Enriched (~14s) — Hero Scene

Replaces 3 former scenes: Kanban (basic drag), Workflow Flow (abstract flowchart), Ticket Detail (static card). One narrative scene in 5 acts:

**Act 1 — Living Board (0-3s)**
- Board appears with tickets distributed across all 6 columns
- Tickets display real job status icons: animated pen (RUNNING) in BUILD, check (COMPLETED) in VERIFY/SHIP
- Tickets in VERIFY/SHIP show quality score badges where applicable
- Active project feel — not an empty board

**Act 2 — Human on the Loop (3-5s)**
- Visible cursor drags a ticket from INBOX to SPECIFY
- Tooltip bubble: *"You decide what to build, and when"*
- Ticket lands in SPECIFY, icon changes to clock (PENDING)

**Act 3 — AI Works (5-8s)**
- Focus shifts to a **different ticket already in BUILD** (e.g. AIB-142): animated pen icon
- Icon transitions from pen to check (COMPLETED)
- Tooltip bubble: *"You supervise, AI executes"*
- Ticket **slides automatically** to VERIFY (no human action — AI-driven transition)

**Act 4 — Quality Gate (8-11s) — Key Moment**
- Ticket arrives in VERIFY, icon progression: clock → pen → check
- **Quality score badge "92"** appears on the card with spring animation
- **Zoom in** on the ticket — shows the detail modal with dimension breakdown:
  - Compliance (40%) → 95
  - Bug Detection (30%) → 88
  - Code Comments (20%) → 91
  - Historical Context (10%) → 87
  - Progress bars for each dimension
- Tooltip bubble: *"Every ticket is evaluated before it ships"*

**Act 5 — Ship (11-14s)**
- Zoom out back to full board view
- Ticket slides to SHIP column with glow effect
- Quality score badge remains visible on the card

### Scene 4: Results/Health (~8s)

Fusion of Analytics + Health into one proof-of-reliability screen.

**Left zone — Key Metrics** (from Analytics):
- Success rate: 94.2% (counter animation)
- Tickets shipped: 138 (counter animation)
- 2-3 stats max, no charts

**Right zone — Health Score** (from Health):
- Animated score circle: 94, label "Excellent"
- 4 module mini-cards: Security 96, Compliance 91, Tests 88, Quality Gate 93
- Each with icon and color

**Removed from current scenes**:
- Cost/time charts from Analytics (not in reliability message)
- Compliance heatmap from Health (too detailed for 8s)
- Sparklines on modules (visual noise)

### Scene 5: Outro (~4s)

- **New heading**: "Built by AI. Verified by standards. Approved by you."
  - Captures the 3 pillars: AI (build), quality gate (verify), human on the loop (you)
- **Keep**: Typewriter "Automatically." — creates narrative loop with Intro
- **Keep**: CTA button "Start building →" with mauve→blue gradient + pulse animation

## Scenes Removed

| Former Scene | Reason | Where Content Went |
|---|---|---|
| Workflow Flow (8s) | Redundant — Kanban enriched shows the flow in action | Kanban Act 1-5 |
| Ticket Detail (6s) | Static and unimpressive | Kanban Act 4 (quality gate zoom) |
| Analytics (6s) | Cost focus doesn't match reliability message | 2-3 metrics in Results scene |
| Comparisons (5s) | Niche feature, dilutes narrative | Removed entirely |

## Video Player Treatment — VideoSection Component

All changes use existing design tokens and CSS patterns from the project.

### Animated Gradient Border
- Reuse `animate-gradient-border` pattern (already on pricing cards)
- Aurora colors: blue → violet → pink, slow rotation (~4s cycle)
- Applied to the video container's `rounded-2xl` border

### Glow Pulse During Playback
- `box-shadow` with aurora colors that breathes softly during video playback
- CSS animation: ~3s ease-in-out infinite
- Only active when video is playing (toggled via `isPlaying` state)

### Enhanced Scroll Entry
- Replace basic `FadeInSection` fade with **scale(0.95) → scale(1) + opacity 0 → 1**
- Duration: 0.7s ease-out
- Video "emerges" into view as user scrolls

### Unchanged
- Hover controls (play/pause, mute buttons) — keep current implementation
- Auto-play on IntersectionObserver (40% threshold)
- Muted + loop behavior

## Technical Scope

### Files to Modify

**Remotion video** (`video/src/`):
- `Video.tsx` — Update scene sequence (remove 4, adjust timings)
- `theme.ts` — Update SCENES timing config for 5 scenes
- `scenes/Intro.tsx` — Update subtitle text
- `scenes/Dashboard.tsx` — Reduce to 4 projects, update metrics
- `scenes/KanbanBoard.tsx` — Full rewrite (5-act narrative with tooltips, zoom, auto-transitions)
- `scenes/HealthDashboard.tsx` — Merge with analytics metrics, simplify
- `scenes/Outro.tsx` — Update heading text

**Files to delete**:
- `scenes/WorkflowFlow.tsx`
- `scenes/TicketDetail.tsx`
- `scenes/Analytics.tsx`
- `scenes/Comparisons.tsx`

**New components needed** (`video/src/components/`):
- `Tooltip.tsx` — Animated tooltip bubble for Kanban scene
- `QualityZoom.tsx` — Quality gate detail view with dimension breakdown

**Landing page** (`components/landing/`):
- `video-section.tsx` — Add gradient border, glow pulse, enhanced entry animation

**Styles** (`app/globals.css`):
- Add video-specific glow pulse animation
- Add video entry scale animation

### Dependencies
- No new packages needed
- All within existing Remotion + Tailwind + CSS setup

## Realistic Data Points

- Workflow duration: **30-45 minutes** (not "4 minutes")
- Typical cost per ticket: varies, do not highlight specific cost
- Quality score thresholds: Green (90+), Blue (70-89), Amber (50-69), Red (0-49)
- Quality dimensions: Compliance (40%), Bug Detection (30%), Code Comments (20%), Historical Context (10%)
