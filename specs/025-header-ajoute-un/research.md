# Research: Application Header Implementation

**Feature**: 025-header-ajoute-un
**Date**: 2025-10-12
**Status**: Complete

## Research Questions & Decisions

### 1. Toast Component Integration

**Question**: Which toast notification library should be used for placeholder button feedback?

**Decision**: Use existing `@radix-ui/react-toast` via shadcn/ui Toast component

**Rationale**:
- Already installed in project dependencies (`package.json` line 31)
- Constitutional requirement: "Use shadcn/ui components exclusively for UI primitives"
- Provides accessible, ARIA-compliant toast notifications out of the box
- Integrates seamlessly with existing Catppuccin Mocha theme via CSS variables
- Zero additional dependencies or configuration needed

**Alternatives Considered**:
- **react-hot-toast**: Popular library with simple API (rejected - violates constitution's "no UI libraries besides shadcn/ui" rule)
- **Custom toast implementation**: DIY solution (rejected - violates "no custom component styling from scratch" rule)
- **Browser alert()**: Native browser API (rejected - poor UX, non-dismissible, blocks UI thread)

**Implementation Notes**:
- Import `useToast` hook from `@/components/ui/use-toast`
- Call `toast({ title: "This feature is not yet implemented" })` on button clicks
- Ensure `<Toaster />` component is present in root layout (may already exist)

---

### 2. Mobile Hamburger Menu Pattern

**Question**: What component pattern should be used for the mobile collapsed menu?

**Decision**: Use shadcn/ui Sheet component for slide-out mobile menu

**Rationale**:
- Sheet component provides accessible drawer/slide-out pattern with proper focus management
- Radix UI primitives (`@radix-ui/react-dialog` foundation) ensure WCAG 2.1 AA compliance
- Animated slide-in/out transitions built-in (no custom CSS animations needed)
- Supports keyboard navigation (Escape to close, Tab trapping)
- Mobile-optimized: Full-screen overlay on small viewports, partial overlay on larger screens

**Alternatives Considered**:
- **Dropdown Menu**: shadcn/ui DropdownMenu component (rejected - better for desktop context menus; Sheet is semantically correct for mobile nav)
- **Popover**: shadcn/ui Popover component (rejected - designed for tooltip-like UI, not full navigation menus)
- **Custom slide-out**: DIY drawer with CSS transitions (rejected - violates constitution, reinventing wheel)

**Implementation Notes**:
- Install Sheet component if not present: `npx shadcn-ui@latest add sheet`
- Use `SheetTrigger` for hamburger icon button
- Use `SheetContent` with `side="right"` for right-side slide-in
- Hide Sheet on `md:` breakpoint and above (show desktop buttons instead)

---

### 3. Fixed/Sticky Header Implementation

**Question**: Should the header use `position: fixed` or `position: sticky`?

**Decision**: Use CSS `position: sticky` with `top: 0` and `z-index: 50`

**Rationale**:
- **Performance**: `sticky` is more performant than `fixed` because it only recalculates position when scrolling past threshold
- **Document Flow**: `sticky` respects document flow; `fixed` removes element from flow (can cause layout shifts)
- **Next.js Compatibility**: Next.js Server Components and hydration work naturally with `sticky` (no layout shifts during hydration)
- **Modal Interactions**: `sticky` plays nicely with modal overlays (z-index stacking); `fixed` can cause scroll issues when modals open
- **Browser Support**: `position: sticky` supported in all modern browsers (95%+ coverage per caniuse.com)

**Alternatives Considered**:
- **position: fixed**: Traditional approach (rejected - document flow issues, hydration layout shifts)
- **JavaScript scroll listener**: Detect scroll and toggle class (rejected - performance overhead, unnecessary complexity)
- **Intersection Observer**: Observer API to toggle fixed class (rejected - over-engineered for simple sticky header)

**Implementation Notes**:
- Apply `sticky top-0 z-50` Tailwind classes to header element
- z-index 50 ensures header stays above page content but below modals (z-50 is standard for sticky headers in Tailwind)
- No JavaScript needed for sticky behavior

---

### 4. Logo SVG Integration

**Question**: How should the `specs/vision/logo/29-final-clean.svg` file be integrated into the header?

**Decision**: Copy SVG to `public/logo.svg` and use Next.js `<Image>` component

**Rationale**:
- **Next.js Convention**: Static assets belong in `public/` directory for direct access
- **Optimization**: Next.js Image component optimizes even SVG files (lazy loading, responsive sizing)
- **Maintainability**: Centralized logo location (if logo changes, update one file)
- **Performance**: Browser caching works automatically for public assets
- **Simple Import**: `src="/logo.svg"` is cleaner than relative paths from specs directory

**Alternatives Considered**:
- **Inline SVG**: Embed SVG code directly in component (rejected - harder to maintain, increases bundle size)
- **External URL**: Host logo on CDN (rejected - unnecessary external dependency for static asset)
- **Import from specs/**: `import logo from '../../specs/vision/logo/29-final-clean.svg'` (rejected - non-standard, breaks public asset convention)

**Implementation Notes**:
- Copy command: `cp specs/vision/logo/29-final-clean.svg public/logo.svg`
- Use Next.js Image: `<Image src="/logo.svg" alt="AI-BOARD Logo" width={32} height={32} />`
- **Color Adjustment** (deferred clarification): Use SVG as-is initially; if color mismatch, apply CSS `filter: brightness() saturate()` or edit SVG `fill` attribute to match Catppuccin Mocha background

**Fallback Strategy** (deferred clarification):
- Implement `onError` handler: If logo fails to load, show text-only "AI-BOARD" with same styling
- Example: `<Image ... onError={() => setLogoError(true)} />` → Conditional render of text fallback

---

### 5. Responsive Breakpoint Strategy

**Question**: At what viewport width should the header switch from desktop (buttons visible) to mobile (hamburger menu)?

**Decision**: Use TailwindCSS `md:` breakpoint (768px) for desktop/mobile toggle

**Rationale**:
- **Industry Standard**: 768px is the de facto breakpoint for tablet/desktop transition
- **Tailwind Default**: `md:` breakpoint aligns with Tailwind's responsive design system (no custom breakpoints needed)
- **Real-World Devices**: Covers iPad Mini (768px), Surface Duo (720px), and most tablets in portrait mode
- **Existing Patterns**: Project likely already uses `md:` for other responsive components (consistency)

**Alternatives Considered**:
- **sm: 640px**: Too early for mobile menu; wastes horizontal space on tablets (rejected)
- **lg: 1024px**: Too late; cramped button layout on tablets (rejected)
- **Custom breakpoint** (e.g., 900px): Non-standard, requires Tailwind config change (rejected - unnecessary complexity)

**Implementation Notes**:
- Desktop buttons: `<div className="hidden md:flex gap-2">...</div>`
- Mobile menu trigger: `<Sheet><SheetTrigger className="md:hidden">...</SheetTrigger></Sheet>`
- Test breakpoints manually in browser DevTools (responsive design mode)

---

### 6. Toast Behavior on Rapid Clicks (Deferred Clarification)

**Question**: If a user rapidly clicks multiple buttons, should toasts stack or replace each other?

**Decision**: Use default shadcn/ui Toast behavior (stacked toasts with auto-dismiss)

**Rationale**:
- **Spec Deferral**: Feature spec marks this as low-impact, acceptable to defer to implementation
- **Library Default**: shadcn/ui Toast stacks toasts by default with 5-second auto-dismiss
- **Good UX**: Stacked toasts provide feedback for each click; auto-dismiss prevents clutter
- **Adjustable Later**: If UX issues arise (e.g., toast spam), can add debouncing or single-toast mode in future iteration

**Alternatives Considered**:
- **Single toast replacement**: Each click replaces previous toast (can implement with `toast.dismiss()` if needed)
- **Debouncing**: Limit toast frequency (e.g., max 1 toast per 2 seconds) (considered if spam becomes issue)
- **Toast queue**: Limit max visible toasts (e.g., show only 3 at once) (shadcn/ui may handle this already)

**Implementation Notes**:
- Default behavior requires no special configuration
- Monitor during manual QA; if rapid clicks create poor UX, implement debounce: `const debouncedToast = debounce(toast, 1000)`

---

### 7. Logo Fallback Strategy (Deferred Clarification)

**Question**: What should display if the logo SVG fails to load?

**Decision**: Show "AI-BOARD" text-only with same typography styling

**Rationale**:
- **Spec Deferral**: Feature spec marks this as low-impact, standard patterns acceptable
- **Graceful Degradation**: Maintains branding even if asset fails to load
- **Simple Implementation**: `onError` handler with conditional rendering (no complex fallback logic)
- **Consistent Branding**: Text logo matches header title styling (users still recognize brand)

**Alternatives Considered**:
- **Generic icon**: Use placeholder icon (e.g., Lucide icon) (rejected - less recognizable than text)
- **Empty space**: Show nothing if logo fails (rejected - poor UX, confusing to users)
- **Error message**: Show "Logo failed to load" (rejected - unprofessional, distracts from content)

**Implementation Notes**:
- State: `const [logoError, setLogoError] = useState(false)`
- Handler: `<Image ... onError={() => setLogoError(true)} />`
- Conditional: `{logoError ? <span className="font-bold text-lg">AI-BOARD</span> : <Image ... />}`

---

## Summary

All research questions resolved with decisions aligned to constitutional requirements:
- ✅ shadcn/ui Toast component (constitutional requirement)
- ✅ shadcn/ui Sheet component for mobile menu (constitutional requirement)
- ✅ CSS `position: sticky` for performance and Next.js compatibility
- ✅ Next.js Image component with public/ directory for logo
- ✅ TailwindCSS `md:` breakpoint (768px) for responsive behavior
- ✅ Default toast behavior acceptable (deferred clarification)
- ✅ Text-only fallback for logo errors (deferred clarification)

**Next Phase**: Design & Contracts (Phase 1)
