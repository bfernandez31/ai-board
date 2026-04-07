# Video System

Remotion-based video generation pipeline for the landing page product demo.

## Architecture

```
ai-board/
├── video/                          # Isolated Remotion project
│   ├── package.json                # Independent deps (remotion, react)
│   ├── tsconfig.json               # ES2022, bundler resolution
│   ├── remotion.config.ts          # Output format config
│   └── src/
│       ├── index.ts                # registerRoot() entry point
│       ├── Root.tsx                 # Composition registration
│       ├── Video.tsx               # Main sequence (9 scenes)
│       ├── theme.ts                # Catppuccin palette, scene timing
│       ├── transitions.ts          # Reusable animation hooks
│       ├── scenes/                 # 9 scene components
│       └── components/             # Shared mock UI components
├── public/videos/
│   └── ai-board-demo.mp4           # Rendered output (served statically)
└── components/landing/
    └── video-section.tsx            # Landing page embed component
```

The `video/` directory is **fully isolated** from the Next.js build:
- Own `package.json` with Remotion-only dependencies
- Own `tsconfig.json` — excluded from root TypeScript config via `tsconfig.json` exclude array
- Next.js ignores `video/` entirely during build
- `video/out/` and `video/node_modules/` are in `.gitignore`

## Video Specification

| Property | Value |
|----------|-------|
| Resolution | 1920 x 1080 (16:9) |
| Frame rate | 30 fps |
| Total frames | 1500 |
| Duration | 50 seconds |
| Codec | H.264 (MP4) |
| File size | ~5.3 MB |

## Scene Composition

All scenes are composed via `<Sequence>` components in `Video.tsx`, each with a `from` frame offset and `durationInFrames`:

| # | Scene | Frames | Duration | Key Animation |
|---|-------|--------|----------|---------------|
| 1 | Intro | 0–120 | 4s | Typewriter "Write a ticket...", aurora gradient reveal |
| 2 | Dashboard | 120–270 | 5s | Project cards stagger-in, animated counters |
| 3 | Kanban Board | 270–450 | 6s | Ticket creation in INBOX, drag-to-SPECIFY animation |
| 4 | Ticket Detail | 450–630 | 6s | Jobs timeline unroll, cost/token counters |
| 5 | Workflow Flow | 630–870 | 8s | Sequential stage pulse with glow, connector lines |
| 6 | Analytics | 870–1050 | 6s | Perspective tilt, line chart draw, bar chart rise |
| 7 | Health Dashboard | 1050–1230 | 6s | Score circle fill, module cards, compliance heatmap |
| 8 | Comparisons | 1230–1380 | 5s | 3D flip entrance, score gauges, winner highlight |
| 9 | Outro | 1380–1500 | 4s | Typewriter "Automatically.", CTA pulse, fade to black |

## Theme System (`theme.ts`)

Colors are hardcoded hex values matching the Catppuccin Mocha palette from `globals.css`. This is intentional — Remotion renders in a headless browser without access to CSS custom properties, so the theme must be self-contained.

Key exports:
- `colors` — full Catppuccin Mocha palette (25 colors)
- `stageColors` — kanban stage color mapping (INBOX→SHIP)
- `fonts` — Righteous (display), DM Sans (body), JetBrains Mono (mono)
- `VIDEO` — dimensions, fps, total frames
- `SCENES` — frame offsets and durations for each scene

## Animation System (`transitions.ts`)

Reusable hooks built on Remotion's `interpolate()` and `spring()`:

| Hook | Purpose |
|------|---------|
| `useZoomIn(delay)` | Scale 0.85→1 with fade, spring physics |
| `usePerspectiveShift(delay, direction)` | 3D rotateY + translateX entrance |
| `useBlurIn(delay)` | Gaussian blur 12→0px (depth of field) |
| `useStagger(index, baseDelay, staggerDelay)` | Per-item fade + translateY for lists |
| `useSlideIn(delay, direction)` | Directional slide with spring |
| `useCounter(target, delay, duration)` | Animated number counting |

**Rules of Hooks**: These hooks use `useCurrentFrame()` internally. They **cannot** be called inside `.map()` loops. All iterated items must be extracted into named components (e.g., `StageColumnWrapper`, `OverviewCard`, `JobRow`).

## Mock Components (`components/`)

Simplified versions of real UI elements, styled with inline CSS using `theme.ts` colors:

| Component | Emulates |
|-----------|----------|
| `AuroraBackground` | Landing page aurora gradient |
| `MockCard` | `aurora-glass` card with glow shadow |
| `MockBadge` | Colored status badge |
| `MockTicket` | Ticket card (key, title, optional cost) |
| `MockColumn` | Kanban stage column (header + body) |
| `MockLineChart` | Animated SVG line chart with progressive draw |
| `MockBarChart` | Animated SVG bar chart with staggered rise |
| `ScoreCircle` | Circular progress gauge (SVG arc + counter) |
| `Typewriter` | Character-by-character text reveal with cursor |

## Rendering

```bash
cd video
bun install
bun run build          # → out/ai-board-demo.mp4
bun run build:webm     # → out/ai-board-demo.webm (optional)
bun run dev            # → Remotion Studio (preview in browser)
```

After rendering, copy the output to `public/videos/`:
```bash
cp video/out/ai-board-demo.mp4 public/videos/
```

## Landing Page Integration

**Component**: `components/landing/video-section.tsx` (client component)

**Placement**: Between `HeroSection` and `SocialProofSection` in `app/landing/page.tsx`, wrapped in `<FadeInSection>`.

**Autoplay**: Uses `IntersectionObserver` with `threshold: 0.4`. Video plays when visible, pauses when scrolled away. Muted by default (browser autoplay policy requires muted).

**Controls**: Play/pause and mute/unmute buttons, visible on hover only.

**Middleware**: `proxy.ts` matcher excludes `.mp4` and `.webm` extensions to allow unauthenticated access to video assets in `public/`.

## Updating the Video

To modify the video content:

1. Edit scene files in `video/src/scenes/`
2. Preview with `cd video && bun run dev` (Remotion Studio)
3. Render with `bun run build`
4. Copy to `public/videos/`
5. Commit both the source changes and the new MP4

Scene timing is centralized in `theme.ts` (`SCENES` constant). To adjust duration or ordering, update the frame offsets there.
