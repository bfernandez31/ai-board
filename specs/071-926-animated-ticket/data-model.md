# Data Model: Animated Ticket Background

**Feature**: 071-926-animated-ticket
**Date**: 2025-10-28

## Overview

This feature is a **frontend-only visual enhancement** with no database entities or API data models. The "data" is purely configuration values defined at build time in TypeScript and TailwindCSS configuration files.

## Configuration Entities

### AnimatedTicketConfig

**Description**: TypeScript type defining animation configuration parameters

**Type Definition**:
```typescript
interface AnimatedTicketConfig {
  /** Total number of ticket elements to render (hidden via CSS on smaller screens) */
  totalTickets: 18;

  /** Breakpoint-specific visibility rules */
  breakpoints: {
    mobile: { maxWidth: 767, visibleTickets: 8 };
    tablet: { minWidth: 768, maxWidth: 1023, visibleTickets: 12 };
    desktop: { minWidth: 1024, visibleTickets: 18 };
  };

  /** Animation timing constraints (seconds) */
  timing: {
    minDuration: 40;
    maxDuration: 60;
    maxDelay: 60;
  };

  /** Visual styling constants */
  visual: {
    width: 64;
    height: 40;
    blurRadius: 2;
    minOpacity: 0.10;
    maxOpacity: 0.15;
    minRotation: -10;
    maxRotation: 10;
  };
}
```

**Validation Rules**:
- `totalTickets` must be ≥ max(visibleTickets) across breakpoints (18 ≥ 12 ≥ 8)
- `timing.minDuration` < `timing.maxDuration` (ensures variation)
- `visual.minOpacity` < `visual.maxOpacity` (ensures variation)
- All numeric values must be positive

**Source Location**: `app/(landing)/components/animated-ticket-background.tsx` (inline constant)

---

### TicketCardProps

**Description**: Props interface for individual animated ticket card component

**Type Definition**:
```typescript
interface TicketCardProps {
  /** Zero-based index for color cycling and nth-child targeting */
  index: number;

  /** Color variant from Catppuccin palette */
  color: 'mauve' | 'blue' | 'sapphire' | 'green' | 'yellow';

  /** Randomized animation duration (40-60s) */
  duration: number;

  /** Randomized animation delay for stagger (0-60s) */
  delay: number;

  /** Randomized vertical position (0-100% of container height) */
  verticalPosition: number;

  /** Randomized rotation angle (-10 to +10 degrees) */
  rotation: number;
}
```

**Validation Rules**:
- `index` must be 0-17 (zero-based for 18 tickets)
- `color` must be one of the 5 defined Catppuccin colors
- `duration` must be 40-60 seconds
- `delay` must be 0-60 seconds
- `verticalPosition` must be 0-100 (percentage)
- `rotation` must be -10 to +10 degrees

**State Lifecycle**: Props are computed once at component render (Server Component), values are deterministic based on `index`

---

## Tailwind Configuration Extensions

### Custom Keyframes

**Description**: CSS animation definition for left-to-right ticket drift

**Configuration**:
```typescript
// tailwind.config.ts
keyframes: {
  'ticket-drift': {
    '0%': {
      transform: 'translateX(-100px) translateY(var(--ticket-y))'
    },
    '100%': {
      transform: 'translateX(calc(100vw + 100px)) translateY(var(--ticket-y))'
    }
  }
}
```

**CSS Variables**:
- `--ticket-y`: Inline style per ticket, randomized vertical offset
- `--ticket-duration`: Inline style per ticket, animation duration
- `--ticket-delay`: Inline style per ticket, animation delay

---

### Custom Colors

**Description**: Catppuccin Mocha palette subset for ticket borders

**Configuration**:
```typescript
// tailwind.config.ts
colors: {
  catppuccin: {
    mauve: '#cba6f7',   // Purple variant
    blue: '#89b4fa',    // Indigo/blue variant
    sapphire: '#74c7ec', // Blue variant
    green: '#a6e3a1',   // Emerald variant
    yellow: '#f9e2af'   // Amber variant
  }
}
```

**Usage**: Applied as `border-catppuccin-{color}/10` (10% opacity) on ticket cards

---

## Derived Data

### Color Assignment Logic

**Function**: Deterministic color assignment based on ticket index

**Algorithm**:
```typescript
function getTicketColor(index: number): CatppuccinColor {
  const colors: CatppuccinColor[] = ['mauve', 'blue', 'sapphire', 'green', 'yellow'];
  return colors[index % colors.length];
}
```

**Rationale**: Modulo operation ensures even distribution across 18 tickets (3-4 tickets per color)

---

### Random Value Generation

**Function**: Seeded randomization for animation properties

**Algorithm**:
```typescript
function getTicketProps(index: number): TicketCardProps {
  // Use index as seed for deterministic randomness (consistent across renders)
  const rng = seededRandom(index);

  return {
    index,
    color: getTicketColor(index),
    duration: 40 + rng() * 20,           // 40-60s
    delay: rng() * 60,                   // 0-60s
    verticalPosition: rng() * 100,       // 0-100%
    rotation: -10 + rng() * 20           // -10 to +10 degrees
  };
}
```

**Rationale**:
- Seeded randomness ensures Server Component renders consistently (no hydration mismatch)
- Index-based seeding allows same ticket to have same properties across builds
- Falls back to `Math.random()` if seeded RNG not needed (acceptable for decorative elements)

---

## No Database Schema Changes

**Database Impact**: NONE

This feature requires:
- ✅ No new Prisma models
- ✅ No migrations
- ✅ No API endpoints
- ✅ No database queries

All configuration is static TypeScript constants and TailwindCSS theme extensions.

---

## Type Safety Guarantees

### Compile-Time Validation

```typescript
// AnimatedTicketBackground component enforces types
const TICKET_CONFIG: AnimatedTicketConfig = {
  totalTickets: 18,
  breakpoints: {
    mobile: { maxWidth: 767, visibleTickets: 8 },
    tablet: { minWidth: 768, maxWidth: 1023, visibleTickets: 12 },
    desktop: { minWidth: 1024, visibleTickets: 18 }
  },
  // ... TypeScript compiler ensures all required fields present
} as const; // const assertion prevents accidental mutation
```

### Runtime Validation (Development Only)

```typescript
if (process.env.NODE_ENV === 'development') {
  // Validate config constraints
  const maxVisible = Math.max(
    TICKET_CONFIG.breakpoints.mobile.visibleTickets,
    TICKET_CONFIG.breakpoints.tablet.visibleTickets,
    TICKET_CONFIG.breakpoints.desktop.visibleTickets
  );

  if (TICKET_CONFIG.totalTickets < maxVisible) {
    throw new Error(
      `totalTickets (${TICKET_CONFIG.totalTickets}) must be >= max visibleTickets (${maxVisible})`
    );
  }
}
```

**Rationale**: Fail fast in development if configuration is invalid, no runtime overhead in production

---

## Summary

This feature uses **configuration-as-data** pattern with no persistent storage:

- **Data Location**: TypeScript constants in component file + Tailwind config
- **Data Flow**: Build-time → Server Component render → Static HTML + CSS
- **Validation**: TypeScript type system + optional dev-mode assertions
- **State Management**: None (static decorative elements, no user interaction)
- **Performance**: Zero runtime overhead (all values computed at build/render time)
