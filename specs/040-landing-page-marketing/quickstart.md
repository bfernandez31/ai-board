# Quick Start Guide: Marketing Landing Page

**Feature**: 040-landing-page-marketing
**Date**: 2025-10-21
**Branch**: `040-landing-page-marketing`

## Overview

This guide helps developers understand, test, and modify the marketing landing page. The feature is presentation-only with no database or API changes.

---

## Prerequisites

**Before starting, ensure you have**:
- Node.js 22.20.0 LTS installed
- Repository cloned and dependencies installed (`npm install`)
- PostgreSQL database running (for NextAuth session checks)
- Environment variables configured (`.env.local` with `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`)

**No new dependencies required** - this feature uses existing stack.

---

## Local Development Setup

### 1. Checkout Feature Branch

```bash
git checkout 040-landing-page-marketing
```

### 2. Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3000`

### 3. Test Landing Page (Unauthenticated)

**Option A: Incognito/Private Browser Window**
1. Open browser in incognito/private mode
2. Visit `http://localhost:3000/`
3. Should see marketing landing page

**Option B: Sign Out if Logged In**
1. Visit `http://localhost:3000/`
2. If redirected to `/projects`, click user avatar → Sign Out
3. Visit `http://localhost:3000/` again
4. Should see marketing landing page

### 4. Test Auth Redirect (Authenticated)

1. Visit `http://localhost:3000/auth/signin`
2. Sign in with test account
3. Visit `http://localhost:3000/`
4. Should immediately redirect to `/projects` (no landing page flash)

---

## File Structure

### Source Files

```
app/
├── page.tsx                         # Modified: Auth check + conditional render
└── landing/
    └── page.tsx                     # New: Landing page Server Component

components/
├── landing/                         # New: Landing page components
│   ├── hero-section.tsx            # Hero with gradient title, CTAs
│   ├── features-grid.tsx           # 6-card grid
│   ├── feature-card.tsx            # Reusable card component
│   ├── workflow-section.tsx        # 5-step timeline
│   ├── workflow-step.tsx           # Individual step component
│   └── cta-section.tsx             # Final call-to-action
│
├── layout/
│   └── header.tsx                  # Modified: Marketing variant logic
│
└── ui/
    └── button.tsx                   # Existing: Used for CTAs

lib/
└── hooks/
    └── use-scroll-to-section.ts    # New: Optional smooth scroll hook

public/
└── landing/
    ├── hero-screenshot.webp        # New: Optimized screenshot
    └── hero-screenshot.png         # New: Fallback image
```

### Test Files

```
tests/
└── e2e/
    └── landing-page.spec.ts        # New: E2E tests for landing flows
```

---

## Component Architecture

### Server Components (Default)

**Files**:
- `app/page.tsx` - Root route with auth check
- `app/landing/page.tsx` - Landing page container
- `components/landing/hero-section.tsx` - Hero section
- `components/landing/features-grid.tsx` - Features grid
- `components/landing/workflow-section.tsx` - Workflow timeline
- `components/landing/cta-section.tsx` - Final CTA

**Why Server Components?**:
- No interactivity needed for these sections
- Better performance (no client-side JS)
- SEO-friendly (fully rendered HTML)

### Client Components

**Files**:
- `components/layout/header.tsx` - Uses `useSession()` for auth state
- `lib/hooks/use-scroll-to-section.ts` - Optional scroll behavior

**Why Client Components?**:
- Need React hooks (`useSession`, `useState`)
- Interactive navigation requires event handlers

---

## TypeScript Interfaces

### Feature Card Props

```typescript
// components/landing/feature-card.tsx
import { type LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
}
```

**Usage**:
```tsx
import { Sparkles } from 'lucide-react';

<FeatureCard
  icon={Sparkles}
  iconColor="#8B5CF6"
  title="AI-Powered Specifications"
  description="Automatically generate detailed specifications..."
/>
```

### Workflow Step Props

```typescript
// components/landing/workflow-step.tsx
interface WorkflowStepProps {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  title: string;
  description: string;
  isLast?: boolean;
}
```

**Usage**:
```tsx
<WorkflowStep
  stage="INBOX"
  title="Create ticket from GitHub issue"
  description="Import issues or create tickets manually"
  isLast={false}
/>
```

---

## Styling Guide

### Theme Colors (Catppuccin Mocha)

**Primary Colors**:
```css
--ctp-base: #1e1e2e        /* Background */
--ctp-mantle: #181825      /* Card background */
--ctp-text: #cdd6f4        /* Primary text */
--ctp-subtext-0: #a6adc8   /* Secondary text */
--primary-violet: #8B5CF6  /* Brand color */
```

**Accent Colors for Icons**:
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

### Responsive Breakpoints

```css
/* Mobile-first approach */
<div className="text-6xl md:text-7xl lg:text-8xl">

/* Breakpoints */
sm: 640px   /* Small devices */
md: 768px   /* Tablets */
lg: 1024px  /* Desktops */
xl: 1280px  /* Large desktops */
```

### Common Patterns

**Gradient Text**:
```tsx
<h1 className="
  bg-gradient-to-r from-[#8B5CF6] via-[#6366F1] to-[#3B82F6]
  bg-clip-text text-transparent
  font-bold
">
  Your Headline
</h1>
```

**Hover Effects**:
```tsx
<div className="
  border border-[hsl(var(--ctp-surface-0))]
  hover:border-[#8B5CF6]/50
  transition-all
  hover:shadow-lg hover:shadow-[#8B5CF6]/10
">
  Card Content
</div>
```

---

## Modifying Content

### Update Marketing Copy

**Hero Headline** (`components/landing/hero-section.tsx`):
```tsx
<h1>Build Better Software with AI-Powered Workflows</h1>
```

**Hero Subheadline**:
```tsx
<p>Transform GitHub issues into actionable tasks with automated workflows...</p>
```

**Feature Card Titles** (`components/landing/features-grid.tsx`):
```tsx
const features = [
  {
    title: 'AI-Powered Specifications',
    description: 'Automatically generate...',
  },
  // ... edit other features
];
```

### Change Colors

**Modify Gradient** (`components/landing/hero-section.tsx`):
```tsx
// Current: Violet → Indigo → Blue
bg-gradient-to-r from-[#8B5CF6] via-[#6366F1] to-[#3B82F6]

// Example: Violet → Pink → Rose
bg-gradient-to-r from-[#8B5CF6] via-[#f5c2e7] to-[#eba0ac]
```

**Icon Colors** (`components/landing/features-grid.tsx`):
```tsx
{
  icon: Sparkles,
  iconColor: '#8B5CF6', // Change to any hex color
}
```

### Replace Hero Screenshot

1. **Capture Screenshot**:
   - Navigate to kanban board in development
   - Use browser devtools or screenshot tool
   - Recommended size: 2400x1600px

2. **Optimize Image**:
   ```bash
   # Convert to WebP (requires cwebp tool)
   cwebp -q 85 screenshot.png -o hero-screenshot.webp

   # Or let Next.js handle it automatically
   # Just place PNG in /public/landing/
   ```

3. **Place Files**:
   ```
   /public/landing/hero-screenshot.webp
   /public/landing/hero-screenshot.png  (fallback)
   ```

4. **Update Component** (`components/landing/hero-section.tsx`):
   ```tsx
   <Image
     src="/landing/hero-screenshot.webp"
     alt="Your screenshot description"
     width={2400}
     height={1600}
     priority
   />
   ```

---

## Testing Guide

### Run E2E Tests

```bash
# Run all tests
npx playwright test

# Run landing page tests only
npx playwright test landing-page

# Run in UI mode (interactive)
npx playwright test --ui

# Run specific test
npx playwright test -g "unauthenticated visitor"
```

### Test Checklist

**Unauthenticated Visitor Flow**:
- [ ] Visit `/` shows landing page (not redirect)
- [ ] Hero section displays with gradient title
- [ ] 6 feature cards render in grid
- [ ] Workflow timeline shows 5 stages
- [ ] "Get Started Free" button redirects to `/auth/signin`
- [ ] "View Demo" button functions (or shows placeholder)

**Authenticated User Flow**:
- [ ] Sign in successfully
- [ ] Visit `/` redirects immediately to `/projects`
- [ ] No landing page flash visible
- [ ] Header shows application variant (user menu, not sign-in button)

**Responsive Layout**:
- [ ] Mobile (< 768px): Vertical stacking, readable text
- [ ] Tablet (768-1024px): 2-column feature grid
- [ ] Desktop (> 1024px): 3-column feature grid, horizontal timeline

**Accessibility**:
- [ ] Keyboard navigation works (Tab through CTAs)
- [ ] Screen reader announces all text content
- [ ] Focus indicators visible on all interactive elements
- [ ] Alt text present on all images

### Manual Testing Checklist

**Visual Inspection**:
```bash
# Start dev server
npm run dev

# Test different viewports in browser devtools
- 375px (Mobile)
- 768px (Tablet)
- 1440px (Desktop)
```

**Performance Testing**:
```bash
# Run Lighthouse audit
- Open Chrome DevTools
- Navigate to Lighthouse tab
- Run audit on http://localhost:3000/ (logged out)
- Verify: Performance > 90, Accessibility > 95
```

---

## Troubleshooting

### Issue: Landing Page Shows Even When Logged In

**Symptom**: Authenticated users see landing page instead of being redirected.

**Cause**: `getServerSession()` not working correctly.

**Fix**:
1. Check `authOptions` import in `app/page.tsx`
2. Verify database connection (session stored in DB)
3. Clear browser cookies and test again
4. Check `NEXTAUTH_SECRET` env var is set

### Issue: Gradient Text Not Showing

**Symptom**: Hero title shows solid color instead of gradient.

**Cause**: Browser doesn't support `background-clip: text` or CSS not applied.

**Fix**:
1. Check browser version (requires modern browser)
2. Verify Tailwind classes applied correctly
3. Inspect element - ensure `background-clip: text` CSS property present

### Issue: Hero Screenshot Not Loading

**Symptom**: Image placeholder shows but screenshot doesn't load.

**Cause**: Image file missing or incorrect path.

**Fix**:
1. Verify file exists: `/public/landing/hero-screenshot.webp`
2. Check Next.js dev server logs for 404 errors
3. Ensure image path in `<Image src>` matches file location
4. Restart dev server after adding new public assets

### Issue: Smooth Scroll Not Working

**Symptom**: Clicking navigation links jumps instead of smoothly scrolling.

**Cause**: CSS `scroll-behavior: smooth` not applied or overridden.

**Fix**:
1. Check `app/globals.css` has `html { scroll-behavior: smooth; }`
2. Verify section IDs match anchor href: `<a href="#features">` → `<section id="features">`
3. Test in different browser (Safari doesn't support CSS smooth scroll)

### Issue: Tests Failing

**Symptom**: Playwright E2E tests fail unexpectedly.

**Cause**: Various - auth state, timing issues, selector changes.

**Debug Steps**:
```bash
# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in debug mode (step through)
npx playwright test --debug

# Generate trace
npx playwright test --trace on
npx playwright show-trace trace.zip
```

**Common Fixes**:
- Clear test database before running tests
- Increase timeout for slow operations
- Update selectors if HTML structure changed
- Ensure test user exists in database

---

## Performance Optimization

### Image Optimization

**Current**: Next.js `<Image>` component handles optimization automatically.

**Manual Optimization** (if needed):
```bash
# Install cwebp tool
brew install webp  # macOS
apt-get install webp  # Linux

# Convert image
cwebp -q 85 input.png -o output.webp

# Verify size reduction
ls -lh input.png output.webp
```

**Target Sizes**:
- Hero screenshot: < 200KB (WebP)
- Icons: Inline SVG (lucide-react, ~2KB total)

### CSS Optimization

**Tailwind automatically purges unused CSS in production build.**

**Manual Check**:
```bash
# Build for production
npm run build

# Check bundle sizes
ls -lh .next/static/css/*.css
```

**Target**: CSS bundle < 50KB (gzipped)

### Lighthouse Audit Targets

Run Lighthouse on production build:

```bash
npm run build
npm start
# Open http://localhost:3000 in Chrome
# DevTools → Lighthouse → Run audit
```

**Target Scores**:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 90

**Key Metrics**:
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Time to Interactive: < 3.5s

---

## Additional Resources

### Documentation

- [Feature Specification](./spec.md) - Requirements and user stories
- [Implementation Plan](./plan.md) - Technical architecture
- [Research Decisions](./research.md) - Technology choices and rationale
- [Data Model](./data-model.md) - N/A for this feature

### External References

- [Next.js 15 App Router Docs](https://nextjs.org/docs/app)
- [NextAuth.js Session Management](https://next-auth.js.org/getting-started/example)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide React Icons](https://lucide.dev/guide/packages/lucide-react)
- [Playwright Testing](https://playwright.dev/docs/intro)

### AI Board Constitution

- [Constitution](/.specify/memory/constitution.md) - Project development standards
- Follow TypeScript-first, component-driven, test-driven principles

---

**Quick Start Status**: ✅ Complete
**Last Updated**: 2025-10-21
**Next**: Run `/speckit.tasks` to generate implementation task checklist
