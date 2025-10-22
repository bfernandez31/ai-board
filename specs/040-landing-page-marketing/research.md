# Research & Technology Decisions: Marketing Landing Page

**Feature**: 040-landing-page-marketing
**Date**: 2025-10-21
**Status**: Phase 0 Complete

## Overview

This document captures technology research, decision rationale, and implementation patterns for the marketing landing page. All decisions align with the project constitution and leverage existing infrastructure.

---

## 1. Server-Side Authentication Check Without Flash

### Problem Statement
Need to check user authentication status on root `/` route and conditionally render landing page or redirect to `/projects` without causing content flash (FOUC).

### Research Findings

**Option A: Client-Side Check with useSession()**
- ❌ Causes flash of landing page before redirect
- ❌ Poor UX and SEO (crawlers see wrong content)
- ✅ Simple implementation

**Option B: Server Component with getServerSession()**
- ✅ No flash - decision made server-side before render
- ✅ Better performance (no client-side JS needed for redirect)
- ✅ SEO-friendly (proper HTTP redirect)
- ✅ Aligns with Next.js 15 App Router best practices
- ❌ Slightly more complex (requires understanding Server Components)

**Option C: Middleware with matcher**
- ✅ Intercepts at edge before page load
- ❌ Overkill for single route check
- ❌ Adds complexity to middleware configuration

### Decision

**Use Server Component with `getServerSession()` in `app/page.tsx`**

**Implementation Pattern**:
```typescript
// app/page.tsx (Server Component)
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import LandingPage from '@/app/landing/page';

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/projects');
  }

  return <LandingPage />;
}
```

**Rationale**:
- Zero flash - server decides before sending HTML
- Follows Next.js 15 App Router conventions
- Reuses existing NextAuth configuration
- No additional dependencies

**Alternatives Rejected**:
- Client-side check: Poor UX with content flash
- Middleware: Over-engineered for single route

**References**:
- Next.js 15 App Router docs: Server Components and data fetching
- NextAuth.js docs: `getServerSession()` in App Router

---

## 2. Smooth Scroll Navigation to Sections

### Problem Statement
Implement smooth scrolling from header navigation links ("Features", "Workflow") to corresponding page sections without page reload.

### Research Findings

**Option A: CSS-Only Solution**
```css
html { scroll-behavior: smooth; }
```
- ✅ Zero JavaScript required
- ✅ Progressive enhancement (fallback to instant scroll)
- ✅ Best performance
- ❌ No control over scroll duration or easing

**Option B: JavaScript scrollIntoView()**
```javascript
element.scrollIntoView({ behavior: 'smooth', block: 'start' });
```
- ✅ Programmatic control
- ✅ Good browser support
- ❌ Requires JS execution
- ❌ Slightly worse performance

**Option C: React Hook with Animation Library**
```typescript
// Custom hook with framer-motion or react-spring
```
- ✅ Full control over animation
- ❌ Adds dependency weight
- ❌ Overkill for simple scroll

### Decision

**CSS-first with optional JS enhancement**

**Implementation Pattern**:
```typescript
// app/globals.css (add if not present)
html {
  scroll-behavior: smooth;
}

// components/landing/header-nav.tsx
<a href="#features" className="hover:text-primary transition-colors">
  Features
</a>

// components/landing/features-grid.tsx
<section id="features">
  {/* content */}
</section>
```

**Optional JS Enhancement** (if needed for offset adjustment):
```typescript
// lib/hooks/use-scroll-to-section.ts
export function useScrollToSection() {
  return (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
}
```

**Rationale**:
- CSS solution covers 90% of use cases with zero dependencies
- JS fallback available if header offset adjustment needed
- Progressive enhancement philosophy
- Respects user's `prefers-reduced-motion` setting automatically

**Alternatives Rejected**:
- Animation library: Unnecessary weight for simple scroll
- Only JS: Worse performance and no progressive enhancement

**References**:
- MDN Web Docs: `scroll-behavior` CSS property
- Web.dev: Scroll to text fragment best practices

---

## 3. Responsive Gradient Typography

### Problem Statement
Implement large gradient text for hero headline that scales responsively across mobile/tablet/desktop and maintains visual hierarchy.

### Research Findings

**Tailwind Gradient Implementation**:
```tsx
<h1 className="bg-gradient-to-r from-[#8B5CF6] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent">
  Build Better Software
</h1>
```

**Responsive Sizing**:
- Mobile (< 768px): `text-6xl` (60px / 3.75rem)
- Tablet (768-1024px): `text-7xl` (72px / 4.5rem)
- Desktop (> 1024px): `text-8xl` (96px / 6rem)

**Browser Compatibility**:
- `background-clip: text` supported in all modern browsers
- `-webkit-background-clip` prefix needed for older Safari

### Decision

**Use Tailwind gradient utilities with responsive font sizing**

**Implementation Pattern**:
```tsx
// components/landing/hero-section.tsx
<h1 className="
  text-6xl md:text-7xl lg:text-8xl
  font-bold
  bg-gradient-to-r from-[#8B5CF6] via-[#6366F1] to-[#3B82F6]
  bg-clip-text text-transparent
  leading-tight
">
  Build Better Software with AI-Powered Workflows
</h1>
```

**Rationale**:
- Uses existing Catppuccin Mocha color palette (violet → indigo → blue)
- Tailwind utilities provide consistent responsive scaling
- No custom CSS needed
- Excellent browser support with automatic vendor prefixes

**Alternatives Rejected**:
- Custom CSS: Duplicates Tailwind functionality
- SVG text: More complex, worse accessibility

**Performance Notes**:
- Gradient text renders efficiently in modern browsers
- No impact on First Contentful Paint
- Fallback: Text remains readable even without gradient support

**References**:
- Tailwind CSS docs: Gradient color stops, responsive design
- Can I Use: `background-clip: text` support table

---

## 4. Hero Screenshot Image Optimization

### Problem Statement
Display large hero screenshot (2400x1600px) without degrading page load performance or Largest Contentful Paint score.

### Research Findings

**Next.js Image Component Features**:
- Automatic format optimization (WebP/AVIF with fallbacks)
- Lazy loading by default
- Responsive srcset generation
- Priority loading for above-the-fold images
- Built-in placeholder support

**Performance Impact**:
| Format | Size (KB) | Load Time (3G) | LCP Impact |
|--------|-----------|----------------|------------|
| PNG (original) | ~800 | 5.3s | HIGH |
| WebP (optimized) | ~180 | 1.2s | LOW |
| AVIF (future) | ~120 | 0.8s | MINIMAL |

### Decision

**Use Next.js `<Image>` component with priority loading and WebP format**

**Implementation Pattern**:
```tsx
// components/landing/hero-section.tsx
import Image from 'next/image';

<Image
  src="/landing/hero-screenshot.webp"
  alt="AI Board kanban interface showing automated workflow stages"
  width={2400}
  height={1600}
  priority // Load immediately (above-the-fold)
  quality={85} // Balance quality vs size
  className="rounded-xl shadow-2xl shadow-[#8B5CF6]/20 border border-[hsl(var(--ctp-surface-0))]"
  placeholder="blur" // Show blur placeholder during load
  blurDataURL="data:image/svg+xml;base64,..." // Generated blur SVG
/>
```

**Asset Pipeline**:
1. Capture screenshot from development environment (actual kanban board)
2. Convert to WebP using `cwebp` or Next.js automatic conversion
3. Place in `/public/landing/hero-screenshot.webp`
4. Next.js handles responsive sizes automatically

**Placeholder Strategy**:
- Use low-quality image placeholder (LQIP) or solid color
- Generate blur data URL for smooth transition
- Maintain aspect ratio to prevent CLS

**Rationale**:
- Next.js Image component is battle-tested and constitution-approved
- WebP reduces size by ~75% vs PNG with minimal quality loss
- Priority loading ensures hero image doesn't delay LCP
- Automatic responsive sizing prevents over-downloading on mobile

**Alternatives Rejected**:
- Raw `<img>` tag: No optimization, poor performance
- CSS background: No lazy loading, worse accessibility
- Third-party CDN: Adds external dependency

**Performance Targets**:
- LCP < 2.5s (hero image fully loaded)
- Image download < 200KB (WebP optimized)
- CLS score < 0.1 (no layout shift)

**References**:
- Next.js docs: `next/image` optimization
- Web.dev: Image optimization best practices

---

## 5. Reusable Feature Card Component Design

### Problem Statement
Create a feature card component that displays icon, title, and description with consistent styling and hover effects, reusable across 6 different features.

### Research Findings

**Component Structure Options**:

**Option A: Compound Components**
```tsx
<FeatureCard>
  <FeatureCard.Icon icon={Sparkles} color="violet" />
  <FeatureCard.Title>AI-Powered</FeatureCard.Title>
  <FeatureCard.Description>...</FeatureCard.Description>
</FeatureCard>
```
- ✅ Maximum flexibility
- ❌ Verbose usage
- ❌ More complex to maintain

**Option B: Props-Based**
```tsx
<FeatureCard
  icon={Sparkles}
  iconColor="#8B5CF6"
  title="AI-Powered Specifications"
  description="Automatically generate..."
/>
```
- ✅ Simple and concise
- ✅ TypeScript strongly typed
- ✅ Easy to validate props
- ❌ Less flexible (but not needed here)

**Icon Type Safety**:
```typescript
import { type LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon; // Type-safe icon component
  iconColor: string;
  title: string;
  description: string;
}
```

### Decision

**Props-based component with `LucideIcon` type**

**Implementation Pattern**:
```typescript
// components/landing/feature-card.tsx
import { type LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, iconColor, title, description }: FeatureCardProps) {
  return (
    <div className="
      bg-[hsl(var(--ctp-mantle))]
      p-8 rounded-lg
      border border-[hsl(var(--ctp-surface-0))]
      hover:border-[#8B5CF6]/50
      transition-all
      hover:shadow-lg hover:shadow-[#8B5CF6]/10
    ">
      <Icon className="w-12 h-12 mb-4" style={{ color: iconColor }} />
      <h3 className="text-xl font-semibold mb-3 text-[hsl(var(--ctp-text))]">
        {title}
      </h3>
      <p className="text-[hsl(var(--ctp-subtext-0))]">
        {description}
      </p>
    </div>
  );
}
```

**Usage in Features Grid**:
```tsx
// components/landing/features-grid.tsx
import { Sparkles, LayoutGrid, Github, Zap, Image, RefreshCw } from 'lucide-react';
import { FeatureCard } from './feature-card';

const features = [
  {
    icon: Sparkles,
    iconColor: '#8B5CF6', // Violet
    title: 'AI-Powered Specifications',
    description: 'Automatically generate detailed specifications...'
  },
  // ... 5 more features
];

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
  {features.map((feature, index) => (
    <FeatureCard key={index} {...feature} />
  ))}
</div>
```

**Rationale**:
- Simple props-based API is sufficient for this use case
- TypeScript `LucideIcon` type ensures type safety
- Inline `style={{ color }}` for dynamic icon colors (Tailwind doesn't support arbitrary colors in className)
- Consistent Catppuccin Mocha colors from existing theme
- Hover effects use existing CSS custom properties

**Alternatives Rejected**:
- Compound components: Over-engineered for simple card
- Card shadcn/ui component: Too generic, need custom styling anyway

**Icon Color Mapping**:
```typescript
const iconColors = {
  violet: '#8B5CF6',  // AI, primary
  blue: '#89b4fa',    // Kanban
  green: '#a6e3a1',   // GitHub
  yellow: '#f9e2af',  // Automation
  pink: '#f5c2e7',    // Images
  cyan: '#89dceb',    // Real-time
};
```

**References**:
- Lucide React docs: Icon component types
- TypeScript docs: Generic component props

---

## 6. Workflow Timeline Visualization

### Problem Statement
Display 5-stage workflow (INBOX → SPECIFY → PLAN → BUILD → VERIFY) as a visual timeline that adapts from vertical (mobile) to horizontal (desktop).

### Research Findings

**Layout Approaches**:

**Option A: CSS Grid with media queries**
```css
.timeline {
  display: grid;
  grid-template-columns: 1fr; /* Mobile: vertical */
}
@media (min-width: 768px) {
  .timeline {
    grid-template-columns: repeat(5, 1fr); /* Desktop: horizontal */
  }
}
```

**Option B: Flexbox with direction change**
```css
.timeline {
  display: flex;
  flex-direction: column; /* Mobile */
}
@media (min-width: 768px) {
  .timeline {
    flex-direction: row; /* Desktop */
  }
}
```

**Visual Connectors**:
- Vertical: Dashed line between steps (CSS border-left)
- Horizontal: Arrow SVG or CSS border-top with ::after pseudo-element

### Decision

**Flexbox with responsive direction change + CSS connectors**

**Implementation Pattern**:
```tsx
// components/landing/workflow-section.tsx
<div className="flex flex-col md:flex-row gap-8 md:gap-4 relative">
  {workflowSteps.map((step, index) => (
    <WorkflowStep
      key={step.stage}
      stage={step.stage}
      title={step.title}
      description={step.description}
      isLast={index === workflowSteps.length - 1}
    />
  ))}
</div>
```

```tsx
// components/landing/workflow-step.tsx
interface WorkflowStepProps {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  title: string;
  description: string;
  isLast?: boolean;
}

export function WorkflowStep({ stage, title, description, isLast }: WorkflowStepProps) {
  const stageColors = {
    INBOX: '#6c7086',    // Catppuccin overlay-0 (gray)
    SPECIFY: '#b4befe',  // Catppuccin lavender
    PLAN: '#89b4fa',     // Catppuccin blue
    BUILD: '#f9cb98',    // Catppuccin peach
    VERIFY: '#f2cdcd',   // Catppuccin flamingo
  };

  return (
    <div className="flex flex-col items-center text-center relative flex-1">
      {/* Stage badge */}
      <div
        className="px-4 py-2 rounded-full text-sm font-semibold mb-4"
        style={{
          backgroundColor: stageColors[stage] + '20',
          color: stageColors[stage]
        }}
      >
        {stage}
      </div>

      {/* Title and description */}
      <h3 className="text-lg font-semibold mb-2 text-[hsl(var(--ctp-text))]">
        {title}
      </h3>
      <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">
        {description}
      </p>

      {/* Connector line (hidden on last item) */}
      {!isLast && (
        <div className="
          hidden md:block absolute top-6 left-1/2 w-full h-0.5
          bg-gradient-to-r from-current to-transparent
          opacity-30
        " />
      )}
    </div>
  );
}
```

**Rationale**:
- Flexbox provides simple direction switch with `flex-direction`
- Stage colors match existing Catppuccin Mocha palette
- CSS gradient connectors (no SVG needed)
- Semantic structure remains logical on mobile (vertical reading flow)

**Alternatives Rejected**:
- CSS Grid: More complex for this linear layout
- SVG timeline: Overkill and harder to maintain
- Timeline library: Adds unnecessary dependency

**Responsive Behavior**:
- Mobile: Vertical stack with natural reading flow
- Tablet/Desktop: Horizontal timeline with equal spacing

**References**:
- MDN: Flexbox layout patterns
- Tailwind CSS: Responsive design utilities

---

## Implementation Priorities

### Phase 1: Core Structure (Critical Path)
1. Root page routing with auth check (`app/page.tsx`)
2. Basic landing page layout (`app/landing/page.tsx`)
3. Header marketing variant logic

### Phase 2: Hero & CTAs (High Value)
4. Hero section with gradient title
5. CTA buttons with navigation
6. Screenshot placeholder integration

### Phase 3: Feature Showcase (Content)
7. Feature card component
8. Features grid with 6 cards
9. Icon integration

### Phase 4: Workflow Visualization (Differentiation)
10. Workflow step component
11. Timeline layout responsive
12. Visual connectors

### Phase 5: Polish & Performance (Quality)
13. Final CTA section
14. Smooth scroll navigation
15. Image optimization
16. Accessibility audit
17. Performance testing

---

## Technology Stack Summary

**Frontend Framework**: Next.js 15 App Router (Server Components by default)
**UI Components**: shadcn/ui Button (existing), custom landing components
**Styling**: TailwindCSS 3.4 with Catppuccin Mocha theme
**Icons**: lucide-react (already installed)
**Images**: Next.js `<Image>` component with WebP optimization
**Authentication**: NextAuth.js `getServerSession()` (existing)
**Testing**: Playwright E2E tests

**New Dependencies**: None required
**Removed Dependencies**: None
**Modified Dependencies**: None

---

## Constitution Compliance Verification

✅ **TypeScript-First**: All components strictly typed with no `any`
✅ **Component-Driven**: Reuses shadcn/ui Button, follows feature folder structure
✅ **Test-Driven**: E2E tests for critical paths (visitor flow, CTA clicks, auth redirect)
✅ **Security-First**: No user input, no sensitive data, auth inherited
✅ **Database Integrity**: N/A (no database changes)

**No constitution violations or exceptions required.**

---

**Research Status**: ✅ Complete
**Next Phase**: Generate quickstart.md and data-model.md
