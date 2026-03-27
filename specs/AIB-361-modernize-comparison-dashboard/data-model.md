# Data Model: Modernize Comparison Dashboard Visual Design

**Date**: 2026-03-27 | **Branch**: `AIB-361-modernize-comparison-dashboard`

## Overview

This feature requires **no database schema changes**. All modifications are purely visual (CSS classes, SVG attributes, component markup). The data model below describes the **in-memory color mapping** structures used at render time.

## Entities

### AccentColorSet

A complete set of Tailwind class strings for a single participant's accent color. Used by all comparison components to apply consistent color identity.

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` (literal) | Full-opacity text color class (e.g., `"text-ctp-green"`) |
| `bgSubtle` | `string` (literal) | Low-opacity background class (e.g., `"bg-ctp-green/10"`) |
| `bgMedium` | `string` (literal) | Medium-opacity background class (e.g., `"bg-ctp-green/20"`) |
| `border` | `string` (literal) | Border color class (e.g., `"border-ctp-green/20"`) |
| `ring` | `string` (literal) | Ring/outline class (e.g., `"ring-ctp-green/30"`) |
| `shadow` | `string` (literal) | Box-shadow glow class for dots (e.g., `"shadow-[0_0_6px_hsl(var(--ctp-green))]"`) |
| `hsl` | `string` (literal) | HSL CSS value for SVG attributes (e.g., `"hsl(var(--ctp-green))"`) |
| `label` | `string` (literal) | Human-readable color name (e.g., `"Green"`) |

**Validation Rules**:
- All class strings are complete static literals (never dynamically constructed)
- All classes reference existing Catppuccin tokens from `tailwind.config.ts`
- `hsl` field is only used in SVG `stop-color` and `stroke` attributes (acceptable exception per spec)

### RankColorMap

A static lookup mapping rank positions (1-6) to `AccentColorSet` objects.

| Rank | Color Token | Label |
|------|-------------|-------|
| 1 | `ctp-green` | Green (Winner) |
| 2 | `ctp-blue` | Blue |
| 3 | `ctp-mauve` | Mauve |
| 4 | `ctp-peach` | Peach |
| 5 | `ctp-pink` | Pink |
| 6 | `ctp-yellow` | Yellow |

**State Transitions**: N/A — static mapping, no state changes.

### StatCardTheme

Color theme for each of the 4 stat cards. Independent of participant rank colors.

| Stat | Color Token | Label |
|------|-------------|-------|
| Cost | `ctp-yellow` | Yellow |
| Duration | `ctp-blue` | Blue |
| Quality Score | `ctp-green` | Green |
| Files Changed | `ctp-mauve` | Purple |

Each theme includes: `text`, `bgSubtle`, `border`, `barGradient` (for progress bar fill).

## Relationships

```
ComparisonDetail (existing, unchanged)
├── participants[] → AccentColorSet (via rank → RankColorMap lookup)
├── decisionPoints[] → AccentColorSet (via verdictTicketId → participant rank lookup)
└── complianceRows[] → (no accent color; uses fixed pass/mixed/fail colors)

ComparisonStatCards (existing, unchanged)
└── stat type → StatCardTheme (static mapping)
```

## Data Flow

1. `ComparisonViewer` receives `ComparisonDetail` from API (unchanged)
2. `ComparisonViewer` derives `participantColorMap: Map<number, AccentColorSet>` by mapping each participant's `rank` through `getAccentColorByRank()`
3. Color map is passed to child components as needed (or children call `getAccentColorByRank()` directly with participant rank)
4. Each component applies the appropriate class strings from `AccentColorSet` to its markup

**No prop interface changes**: Color is derived from the existing `rank` field on `ComparisonParticipantDetail`. Components already receive participants as props.
