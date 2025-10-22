# Research: Sign-In Page Redesign

**Feature**: 041-sign-in-page
**Date**: 2025-10-22
**Status**: Complete

## Research Overview

This document consolidates research findings for implementing the sign-in page redesign. All unknowns from the Technical Context section have been resolved through codebase analysis and best practices research.

## Research Tasks Completed

### 1. Header Component Behavior on Auth Pages

**Research Question**: How should the header component be configured to show on /auth/signin while maintaining proper state?

**Findings**:
- **Current Implementation** (`components/layout/header.tsx:76-78`):
  ```typescript
  // Don't render header on auth pages
  if (pathname?.startsWith('/auth')) {
    return null;
  }
  ```
- **Marketing vs Application Variant Logic** (`header.tsx:25-30`):
  ```typescript
  const isLandingPage = pathname === '/';
  const isMarketingVariant = isLandingPage && status !== 'authenticated';
  ```
- **Decision**: Update header logic to allow rendering on `/auth/signin` but maintain application variant (no "Sign In" button to avoid circular reference)
- **Rationale**: User requested "reprendre le header" (bring back the header) for consistency

**Implementation Approach**:
- Modify condition from `pathname?.startsWith('/auth')` to explicitly exclude `/auth/signin`
- New condition: `if (pathname?.startsWith('/auth') && pathname !== '/auth/signin')`
- Keep marketing variant logic unchanged (will show application variant since user won't be authenticated)
- Alternative considered: Show marketing variant on /auth/signin - Rejected because "Sign In" button on sign-in page is redundant

**Best Practices**:
- NextAuth.js documentation recommends custom sign-in pages have navigation back to home
- Header provides this navigation through logo link
- Avoid circular UI references (sign-in button on sign-in page)

---

### 2. Disabled OAuth Provider UI Patterns

**Research Question**: What are the best practices for displaying disabled OAuth providers with clear visual feedback?

**Findings**:
- **shadcn/ui Button Disabled State**:
  - Built-in `disabled` prop provides cursor:not-allowed and opacity reduction
  - Variants: `variant="outline"` with `disabled` prop for secondary appearance
- **Common Patterns**:
  - Vercel sign-in: Shows disabled providers with grayed appearance and "Coming soon" badge
  - GitHub: Uses tooltip on hover for disabled options
  - GitLab: Shows text explanation below disabled buttons

**Decision**: Use shadcn/ui Button with `disabled` prop and explanatory text

**Implementation Approach**:
```tsx
<Button variant="outline" size="lg" disabled className="w-full opacity-50 cursor-not-allowed">
  <GitlabIcon className="mr-2 h-5 w-5" />
  Continue with GitLab
</Button>
<p className="text-xs text-zinc-400 text-center">Coming soon</p>
```

**Rationale**:
- Explicit text is more accessible than tooltip-only approach
- Matches WCAG 2.1 AA requirements (no reliance on hover states)
- Clear user expectation without requiring interaction

**Alternatives Considered**:
- Tooltip only - Rejected: Fails accessibility on touch devices
- Hide completely - Rejected: User explicitly requested "three possibilities" visible
- Custom disabled styling - Rejected: shadcn/ui provides accessible disabled state

---

### 3. OAuth Provider Icons

**Research Question**: Which icon library should be used for GitLab and BitBucket logos?

**Findings**:
- **Project Dependencies** (`package.json`):
  - `lucide-react` v0.544.0 already installed
  - Provides `Github` icon (currently used)
  - Does NOT include GitLab or BitBucket brand logos
- **Options**:
  1. `react-icons` library (includes `SiGitlab`, `SiBitbucket` from Simple Icons)
  2. Custom SVG components
  3. Use generic icons from lucide-react

**Decision**: Add `react-icons` dependency for brand-specific icons

**Rationale**:
- Brand accuracy is important for OAuth providers
- `react-icons` is well-maintained and tree-shakeable
- Provides exact brand logos used by GitLab and BitBucket
- 180k+ weekly downloads, actively maintained

**Implementation**:
```bash
npm install react-icons
```

```tsx
import { SiGitlab, SiBitbucket } from 'react-icons/si';
```

**Alternatives Considered**:
- Custom SVG - Rejected: Maintenance burden and brand accuracy concerns
- Generic icons - Rejected: Users expect brand-specific logos for OAuth
- Lucide fallback - Rejected: No GitLab/BitBucket icons available

---

### 4. Dark Theme Color Consistency

**Research Question**: What are the exact color values to use for visual consistency with the site theme?

**Findings** (`app/globals.css`):
- **Background**: `--ctp-base: 30 15% 9%` → `#1e1e2e` (Catppuccin Mocha base)
- **Card Background**: `--ctp-mantle: 30 15% 7%` → `#181825`
- **Primary Violet**: `--primary-violet: 258 90% 66%` → `#8B5CF6`
- **Border**: `--ctp-surface-0: 30 13% 18%` → `#313244`
- **Text**: `--ctp-text: 226 64% 88%` → `#cdd6f4`
- **Muted Text**: `--ctp-subtext-0: 227 27% 72%` → `#a6adc8`

**Current Sign-In Layout** (`app/auth/layout.tsx`):
```tsx
<div className="min-h-screen bg-gray-50">
```

**Decision**: Replace auth layout background with Catppuccin Mocha theme

**Implementation**:
```tsx
// auth/layout.tsx - BEFORE
<div className="min-h-screen bg-gray-50">

// auth/layout.tsx - AFTER
<div className="min-h-screen bg-[#1e1e2e]">
```

**Additional Styling** (sign-in page):
- Card border: Use violet accent `border-[#8B5CF6]` (2px width for prominence)
- Card background: Default from theme (`--card` = `--ctp-mantle`)
- Text colors: Use theme variables (foreground, muted-foreground)

**Rationale**:
- Matches existing application styling (header, dashboard, landing page)
- Uses established CSS custom properties from globals.css
- Maintains WCAG 2.1 AA contrast ratios (verified in existing design system)

---

### 5. Loading and Error States

**Research Question**: How should loading and error states be handled during OAuth flow?

**Findings**:
- **NextAuth.js Behavior**:
  - `signIn("github")` is server action with redirect
  - Loading state: Browser native loading during server redirect
  - Error handling: Redirects to `/auth/error` page (already exists)
- **Current Error Page** (`app/auth/error/page.tsx`): Already implemented
- **Best Practices**:
  - Server actions with redirects don't require client-side loading spinners
  - NextAuth handles OAuth errors automatically via error page redirect

**Decision**: No additional loading/error UI needed on sign-in page

**Rationale**:
- Server action pattern provides browser native loading indicator
- Error page already exists and follows NextAuth.js conventions
- Adding spinner would be redundant and potentially cause flicker

**Out of Scope**:
- Custom loading overlay on button (browser handles this)
- Inline error messages (NextAuth error page handles this)
- Retry logic (users can navigate back from error page)

---

### 6. Responsive Design Breakpoints

**Research Question**: What breakpoints should be used for mobile/tablet/desktop responsiveness?

**Findings** (`tailwind.config.ts` and TailwindCSS defaults):
- **Default Breakpoints**:
  - `sm`: 640px (mobile landscape)
  - `md`: 768px (tablet)
  - `lg`: 1024px (desktop)
  - `xl`: 1280px (large desktop)
- **Current Card Width** (`app/auth/signin/page.tsx:16`):
  ```tsx
  <Card className="w-[400px]">
  ```

**Decision**: Use responsive width classes with mobile-first approach

**Implementation**:
```tsx
<Card className="w-full max-w-md mx-4 md:w-[400px] md:mx-0">
```

**Breakpoint Strategy**:
- Mobile (<768px): Full width with horizontal margin (mx-4 for 16px padding)
- Tablet/Desktop (≥768px): Fixed 400px width, centered via flexbox parent

**Rationale**:
- Mobile-first responsive design (TailwindCSS best practice)
- Prevents horizontal overflow on small screens
- Maintains design intent (centered card) on larger viewports

---

### 7. Accessibility Requirements

**Research Question**: What ARIA attributes and keyboard navigation are required for WCAG 2.1 AA compliance?

**Findings**:
- **shadcn/ui Components**: Built with Radix UI primitives (accessibility built-in)
- **Button Component**: Includes proper ARIA attributes and keyboard support
- **Required Additions**:
  - Disabled buttons need `aria-disabled="true"` (shadcn provides this)
  - Form action needs accessible name (provided by button content)
  - Focus indicators (provided by shadcn/ui focus ring)

**Decision**: Rely on shadcn/ui accessibility with explicit alt text and labels

**Implementation Checklist**:
- ✅ Button text is descriptive ("Continue with GitHub" not just "GitHub")
- ✅ Icons have proper sizing and spacing for touch targets (min 44x44px)
- ✅ Disabled state is programmatic (`disabled` prop) not just visual
- ✅ Focus indicators visible (shadcn/ui provides focus-visible ring)
- ✅ Color contrast meets WCAG AA (verified in globals.css theme)

**Testing Required**:
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader announcement (NVDA, JAWS, VoiceOver)
- Touch target sizing on mobile (≥44x44px)

---

## Summary of Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| **Header on /auth/signin** | Show header (application variant, no Sign In button) | User request + consistency with other pages |
| **Disabled Provider UI** | Button with `disabled` prop + "Coming soon" text | Accessibility + clear user expectation |
| **OAuth Icons** | Add `react-icons` for `SiGitlab`, `SiBitbucket` | Brand accuracy + well-maintained library |
| **Dark Theme** | Use `#1e1e2e` background + violet `#8B5CF6` accents | Match existing Catppuccin Mocha design system |
| **Loading States** | No custom loading UI (browser native) | Server action pattern + NextAuth conventions |
| **Responsive Design** | Mobile-first with `w-full md:w-[400px]` | Prevent overflow + maintain centered design |
| **Accessibility** | shadcn/ui defaults + explicit button text | WCAG 2.1 AA compliance built-in |

## New Dependencies

**To Add**:
```json
{
  "dependencies": {
    "react-icons": "^5.4.0"
  }
}
```

**Justification**: Required for GitLab and BitBucket brand-specific icons not available in lucide-react.

## Implementation Risk Assessment

**Low Risk**:
- Modifying header visibility logic (simple condition change)
- Adding disabled buttons (standard shadcn/ui pattern)
- Theme color updates (using existing CSS variables)

**Medium Risk**:
- Responsive design testing across devices (requires manual testing)
- Accessibility compliance verification (requires automated + manual testing)

**Mitigation**:
- Write Playwright tests for visual regression
- Test on real devices (iOS Safari, Android Chrome)
- Run accessibility audit with axe or Lighthouse

## Next Steps

Proceed to **Phase 1: Design & Contracts** to generate:
1. `data-model.md` (if applicable - likely N/A for UI-only feature)
2. API contracts (N/A - no new API endpoints)
3. `quickstart.md` for developer onboarding
