# Header Feature Quickstart

**Feature**: 025-header-ajoute-un
**Purpose**: Manual validation guide for application header implementation
**Estimated Time**: 5 minutes

## Prerequisites

- Development server running: `npm run dev`
- Browser with responsive design tools (Chrome DevTools, Firefox Developer Tools, etc.)
- Terminal access for test execution

## User Scenario: View Header and Test Placeholder Buttons

### Step 1: Start Development Server

```bash
npm run dev
```

Wait for server to start on http://localhost:3000

### Step 2: Verify Header Appearance (Desktop)

1. Navigate to **http://localhost:3000/** (home page)
2. Observe header at top of page

**Expected Results**:
- ✅ Header visible at top of viewport
- ✅ Header fixed/sticky (stays visible when scrolling)
- ✅ AI-BOARD logo visible on left side (purple columns icon from 29-final-clean.svg)
- ✅ "AI-BOARD" title text displayed next to logo
- ✅ Three buttons visible on right side: "Log In", "Contact", "Sign Up"
- ✅ Header uses Catppuccin Mocha colors:
  - Background: Dark (`bg-ctp-mantle` or `bg-ctp-base`)
  - Text: Light (`text-ctp-text`)
  - Buttons: Subtle styling with violet accents on hover

### Step 3: Test Desktop Button Interactions

1. Click **"Log In"** button
   - **Expected**: Toast notification appears with message: "This feature is not yet implemented"
   - Toast should auto-dismiss after ~5 seconds

2. Click **"Contact"** button
   - **Expected**: Same toast message appears

3. Click **"Sign Up"** button
   - **Expected**: Same toast message appears

4. **Rapid Click Test**: Click multiple buttons quickly
   - **Expected**: Toasts stack (multiple toasts visible at once) OR replace each other
   - No JavaScript errors in console
   - Toasts auto-dismiss after timeout

### Step 4: Test Site-Wide Header Presence

Navigate to different pages and verify header appears on all pages:

1. Navigate to **http://localhost:3000/projects** (projects page)
   - ✅ Header visible and functional

2. Navigate to **http://localhost:3000/projects/3/board** (board page)
   - ✅ Header visible and functional

3. Navigate back to **http://localhost:3000/** (home page)
   - ✅ Header still visible and functional

**Expected**: Header is present and identical on all pages (site-wide layout component)

### Step 5: Test Scroll Behavior

1. Navigate to a page with scrollable content (e.g., board page with many tickets)
2. Scroll down the page

**Expected Results**:
- ✅ Header remains visible at top of viewport (sticky/fixed positioning)
- ✅ Header does not scroll away with page content
- ✅ Header maintains same styling while scrolling

### Step 6: Test Mobile Responsive Behavior

1. Open browser DevTools (F12 or right-click → Inspect)
2. Enable responsive design mode (Ctrl+Shift+M or Cmd+Shift+M)
3. Set viewport width to **375px** (mobile phone simulation)

**Expected Results - Mobile Layout**:
- ✅ Header still visible at top
- ✅ Logo and "AI-BOARD" title visible on left
- ✅ Desktop buttons ("Log In", "Contact", "Sign Up") **hidden**
- ✅ Hamburger menu icon visible on right side (three horizontal lines)

### Step 7: Test Mobile Menu Interaction

1. Click **hamburger menu icon** (three lines)

**Expected Results**:
- ✅ Mobile menu slides in from right side
- ✅ Overlay darkens background (Sheet component backdrop)
- ✅ Three buttons visible in menu: "Log In", "Contact", "Sign Up"

2. Click **"Log In"** button in mobile menu

**Expected Results**:
- ✅ Toast notification appears: "This feature is not yet implemented"
- ✅ Mobile menu closes automatically (or remains open, depending on implementation)

3. If menu is still open, click **outside menu** (on dark overlay)

**Expected Result**:
- ✅ Mobile menu closes (Sheet component default behavior)

4. Reopen menu with hamburger icon, then press **Escape key**

**Expected Result**:
- ✅ Mobile menu closes (keyboard accessibility)

### Step 8: Test Responsive Breakpoint

1. In responsive design mode, gradually increase viewport width from 375px to 1024px
2. Observe header behavior at **768px** (md: breakpoint)

**Expected Results**:
- ✅ Below 768px: Hamburger menu visible, desktop buttons hidden
- ✅ At 768px and above: Desktop buttons visible, hamburger menu hidden
- ✅ Smooth transition (no layout jumps or flashing)

### Step 9: Test Logo Fallback (Optional)

1. Open DevTools → Network tab
2. Block `/logo.svg` file (right-click → Block request URL)
3. Reload page

**Expected Result** (if fallback implemented):
- ✅ Logo image hidden
- ✅ "AI-BOARD" text displayed in place of logo (same styling as title)
- ✅ No broken image icon visible

### Step 10: Run E2E Test (Automated Validation)

```bash
npm run test:e2e tests/e2e/header.spec.ts
```

**Expected Results**:
- ✅ All tests pass
- ✅ Test coverage includes:
  - Header visibility on multiple pages
  - Button click interactions
  - Toast notification appearance
  - Mobile menu functionality (if included in test)

## Validation Checklist

Use this checklist to confirm all acceptance criteria are met:

### Functional Requirements
- [ ] **FR-001**: Header displays at top of all pages with fixed/sticky positioning
- [ ] **FR-002**: Logo (29-final-clean.svg) displays correctly
- [ ] **FR-003**: "AI-BOARD" title text displays next to logo
- [ ] **FR-004**: Three buttons display on desktop: "Log In", "Contact", "Sign Up"
- [ ] **FR-004 Mobile**: Buttons collapse into hamburger menu below 768px
- [ ] **FR-005**: Catppuccin Mocha colors applied (dark background, light text, violet accents)
- [ ] **FR-007**: Toast notification appears when any button is clicked
- [ ] **FR-008**: Toast displays message: "This feature is not yet implemented"
- [ ] **FR-009**: Layout similar to Vercel header (logo/title left, buttons right)
- [ ] **FR-010**: Buttons are interactive (clickable) but placeholder functionality

### Non-Functional Requirements
- [ ] Header renders in <100ms (no noticeable delay)
- [ ] No console errors during interaction
- [ ] Responsive behavior smooth at all breakpoints
- [ ] Sticky positioning works on all pages
- [ ] Mobile menu accessible via keyboard (Escape key closes menu)
- [ ] Logo loads without visual glitches

### Edge Cases
- [ ] Rapid button clicks handled gracefully (no crashes or UI freezes)
- [ ] Mobile menu closes after button click (or explicit close action)
- [ ] Header does not overlap page content or modals (z-index correct)
- [ ] Logo fallback displays if image fails to load (if implemented)

## Troubleshooting

### Issue: Header not visible
- **Check**: Verify `<Header />` component imported and rendered in `app/layout.tsx`
- **Check**: Inspect element with DevTools → Ensure header element exists in DOM
- **Check**: Verify no CSS `display: none` or `visibility: hidden` applied

### Issue: Buttons not clickable
- **Check**: Verify `"use client"` directive present in `components/layout/header.tsx`
- **Check**: Console for JavaScript errors during button click
- **Check**: Toast component (`<Toaster />`) present in root layout

### Issue: Toast not appearing
- **Check**: Verify `@radix-ui/react-toast` installed in dependencies
- **Check**: Import `useToast` hook correctly from `@/components/ui/use-toast`
- **Check**: `<Toaster />` component rendered in root layout

### Issue: Mobile menu not working
- **Check**: Verify Sheet component installed: `npx shadcn-ui@latest add sheet`
- **Check**: Verify `@radix-ui/react-dialog` dependency present (Sheet foundation)
- **Check**: Console for React hydration errors (Server/Client Component mismatch)

### Issue: Sticky positioning not working
- **Check**: Verify `sticky top-0` classes applied to header element
- **Check**: Parent elements do not have `overflow: hidden` or `overflow: auto` (breaks sticky)
- **Check**: Browser compatibility (sticky supported in all modern browsers)

### Issue: Logo not displaying
- **Check**: Verify logo copied to `public/logo.svg`
- **Check**: Verify file path is `/logo.svg` (not relative path)
- **Check**: Inspect Network tab in DevTools → Verify 200 OK response for logo file

## Success Criteria

**Minimum Passing Grade**:
- Header visible on all pages ✅
- Buttons trigger toast notifications ✅
- Mobile menu functional below 768px ✅
- No console errors ✅
- E2E test passes ✅

**Excellent Implementation**:
- All items in Validation Checklist checked ✅
- Smooth responsive behavior ✅
- Logo fallback implemented ✅
- Keyboard accessibility tested ✅
- Manual QA on multiple browsers (Chrome, Firefox, Safari) ✅

## Next Steps

After quickstart validation:
1. Address any failing checklist items
2. Run full E2E test suite: `npm run test:e2e`
3. Manual cross-browser testing (Chrome, Firefox, Safari)
4. Verify Catppuccin Mocha color accuracy (compare to design system)
5. Optional: Test on real mobile devices (not just DevTools simulation)
6. Mark feature as complete and merge to main branch
