# Quickstart: Sign-In Page Redesign

**Feature**: 041-sign-in-page
**Branch**: `041-sign-in-page`
**Target**: Developers implementing or reviewing this feature

## Overview

This guide walks through implementing the sign-in page redesign to match the site's dark theme and display three OAuth provider options (GitHub active, GitLab/BitBucket disabled).

**Time Estimate**: 2-3 hours (including testing)

**Prerequisites**:
- Node.js 22.20.0 LTS installed
- Repository cloned and dependencies installed (`npm install`)
- Environment variables configured (`.env.local` with `GITHUB_ID` and `GITHUB_SECRET`)
- Basic familiarity with Next.js 15, React 18, and TypeScript

---

## Step 1: Install New Dependencies

Add the `react-icons` package for GitLab and BitBucket brand icons:

```bash
npm install react-icons
```

**Why**: lucide-react doesn't include GitLab/BitBucket brand logos. react-icons provides Simple Icons library with accurate brand SVGs.

**Verify Installation**:
```bash
grep "react-icons" package.json
# Should show: "react-icons": "^5.4.0"
```

---

## Step 2: Update Auth Layout (Remove Header Hide)

**File**: `app/auth/layout.tsx`

**Before**:
```tsx
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
```

**After**:
```tsx
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1e1e2e]">
      {children}
    </div>
  );
}
```

**Changes**:
- Replace `bg-gray-50` with `bg-[#1e1e2e]` (Catppuccin Mocha base color)
- Matches dark theme used across the application

**Why**: User explicitly requested the sign-in page match the site theme (dark background)

---

## Step 3: Update Header Component Logic

**File**: `components/layout/header.tsx`

**Before** (line 76-78):
```tsx
// Don't render header on auth pages
if (pathname?.startsWith('/auth')) {
  return null;
}
```

**After**:
```tsx
// Don't render header on auth pages except /auth/signin
if (pathname?.startsWith('/auth') && pathname !== '/auth/signin') {
  return null;
}
```

**Why**: User requested "reprendre le header" (bring back the header) for consistency. The header provides branding and navigation back to the home page.

**Testing**:
```bash
# Start dev server
npm run dev

# Navigate to http://localhost:3000/auth/signin
# Header should be visible with logo and "AI-BOARD" text
# No "Sign In" button should appear (application variant)
```

---

## Step 4: Redesign Sign-In Page

**File**: `app/auth/signin/page.tsx`

**Full Implementation** (replace entire file):

```tsx
import { signIn } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Github } from "lucide-react"
import { SiGitlab, SiBitbucket } from "react-icons/si"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const params = await searchParams
  const callbackUrl = params.callbackUrl || "/projects"

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md border-[#8B5CF6] border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to AI Board</CardTitle>
          <CardDescription className="text-[hsl(var(--ctp-subtext-0))]">
            Sign in with your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* GitHub OAuth - Active */}
          <form action={async () => {
            "use server"
            await signIn("github", {
              redirectTo: callbackUrl
            })
          }}>
            <Button type="submit" className="w-full" size="lg">
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
          </form>

          {/* GitLab OAuth - Disabled */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              disabled
              className="w-full opacity-50 cursor-not-allowed"
            >
              <SiGitlab className="mr-2 h-5 w-5" />
              Continue with GitLab
            </Button>
            <p className="text-xs text-[hsl(var(--ctp-subtext-0))] text-center">
              Coming soon
            </p>
          </div>

          {/* BitBucket OAuth - Disabled */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              disabled
              className="w-full opacity-50 cursor-not-allowed"
            >
              <SiBitbucket className="mr-2 h-5 w-5" />
              Continue with BitBucket
            </Button>
            <p className="text-xs text-[hsl(var(--ctp-subtext-0))] text-center">
              Coming soon
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Key Changes**:
1. **Imports**: Add `SiGitlab`, `SiBitbucket` from `react-icons/si`
2. **Card Border**: Add `border-[#8B5CF6] border-2` (violet accent)
3. **Responsive Width**: Use `w-full max-w-md` + `px-4` padding
4. **Text Colors**: Use theme variables (`--ctp-subtext-0`)
5. **Disabled Providers**: Add GitLab and BitBucket with `disabled` prop
6. **"Coming Soon" Labels**: Explanatory text below disabled buttons

---

## Step 5: Write E2E Tests (TDD - Red Phase)

**File**: `tests/e2e/auth-signin.spec.ts` (create new file)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Sign-In Page Redesign', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin');
  });

  test('displays header on sign-in page', async ({ page }) => {
    // Header should be visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Logo should be present
    const logo = page.locator('img[alt="AI-BOARD Logo"]');
    await expect(logo).toBeVisible();

    // "AI-BOARD" text should be visible
    await expect(page.getByText('AI-BOARD')).toBeVisible();

    // Sign In button should NOT be visible (application variant)
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).not.toBeVisible();
  });

  test('displays dark theme background', async ({ page }) => {
    const body = page.locator('body');
    const bgColor = await body.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );

    // Catppuccin Mocha base: #1e1e2e = rgb(30, 30, 46)
    expect(bgColor).toBe('rgb(30, 30, 46)');
  });

  test('displays card with violet border', async ({ page }) => {
    const card = page.locator('[class*="border-\\[\\#8B5CF6\\]"]').first();
    await expect(card).toBeVisible();

    const borderColor = await card.evaluate((el) =>
      window.getComputedStyle(el).borderColor
    );

    // #8B5CF6 = rgb(139, 92, 246)
    expect(borderColor).toBe('rgb(139, 92, 246)');
  });

  test('displays three OAuth provider buttons', async ({ page }) => {
    // GitHub button - active
    const githubButton = page.getByRole('button', { name: /continue with github/i });
    await expect(githubButton).toBeVisible();
    await expect(githubButton).toBeEnabled();

    // GitLab button - disabled
    const gitlabButton = page.getByRole('button', { name: /continue with gitlab/i });
    await expect(gitlabButton).toBeVisible();
    await expect(gitlabButton).toBeDisabled();

    // BitBucket button - disabled
    const bitbucketButton = page.getByRole('button', { name: /continue with bitbucket/i });
    await expect(bitbucketButton).toBeVisible();
    await expect(bitbucketButton).toBeDisabled();
  });

  test('displays "Coming soon" text for disabled providers', async ({ page }) => {
    const comingSoonLabels = page.getByText('Coming soon');
    await expect(comingSoonLabels).toHaveCount(2); // GitLab + BitBucket
  });

  test('GitHub button has proper icon and spacing', async ({ page }) => {
    const githubButton = page.getByRole('button', { name: /continue with github/i });

    // Icon should be present (check for svg element)
    const icon = githubButton.locator('svg').first();
    await expect(icon).toBeVisible();

    // Verify icon size (lucide-react default: h-5 w-5 = 20px)
    const iconSize = await icon.evaluate((el) => ({
      width: el.clientWidth,
      height: el.clientHeight,
    }));
    expect(iconSize.width).toBe(20);
    expect(iconSize.height).toBe(20);
  });

  test('is responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    const card = page.locator('[class*="max-w-md"]').first();
    await expect(card).toBeVisible();

    // Card should not overflow viewport
    const cardBox = await card.boundingBox();
    expect(cardBox!.width).toBeLessThanOrEqual(375);
  });

  test('preserves callbackUrl parameter', async ({ page }) => {
    await page.goto('/auth/signin?callbackUrl=/projects/3/board');

    // GitHub button form should preserve callbackUrl
    const githubButton = page.getByRole('button', { name: /continue with github/i });
    await expect(githubButton).toBeVisible();

    // Note: Actual OAuth redirect testing requires GitHub credentials
    // This test just verifies the page loads with callbackUrl param
  });
});
```

**Run Tests** (should fail - Red phase):
```bash
npm run test:e2e
```

**Expected Result**: Tests fail because code changes not yet applied

---

## Step 6: Apply Code Changes (Green Phase)

After writing tests, apply the code changes from Steps 2-4.

**Run Tests Again**:
```bash
npm run test:e2e
```

**Expected Result**: All tests pass (Green phase)

---

## Step 7: Manual Testing Checklist

### Visual Consistency
- [ ] Sign-in page background matches dashboard background (#1e1e2e)
- [ ] Card border is violet (#8B5CF6) and visible
- [ ] Header is present with logo and "AI-BOARD" text
- [ ] No "Sign In" button in header (application variant)
- [ ] Text colors use Catppuccin Mocha theme variables

### OAuth Providers
- [ ] GitHub button is interactive (enabled state)
- [ ] GitLab button is grayed out (disabled state)
- [ ] BitBucket button is grayed out (disabled state)
- [ ] "Coming soon" text appears below disabled buttons
- [ ] All buttons have proper icons (GitHub, GitLab, BitBucket logos)

### Responsive Design
- [ ] Mobile (375px): Card takes full width with padding
- [ ] Tablet (768px): Card remains centered at 400px width
- [ ] Desktop (1024px+): Card remains centered at 400px width
- [ ] No horizontal overflow at any viewport size

### Accessibility
- [ ] Keyboard navigation works (Tab to buttons, Enter to submit)
- [ ] Disabled buttons have `aria-disabled="true"`
- [ ] Focus indicators visible on all interactive elements
- [ ] Screen reader announces button states correctly

### OAuth Flow
- [ ] Clicking GitHub button redirects to GitHub OAuth
- [ ] After GitHub auth, user redirects to /projects (or callbackUrl)
- [ ] Authenticated users accessing /auth/signin redirect to /projects
- [ ] OAuth errors redirect to /auth/error page

---

## Step 8: Accessibility Audit

Run Lighthouse audit on sign-in page:

```bash
# Start dev server
npm run dev

# Open Chrome DevTools
# Navigate to http://localhost:3000/auth/signin
# Run Lighthouse audit (Accessibility category)
```

**Target Scores**:
- Accessibility: ≥95 (WCAG 2.1 AA compliance)
- Performance: ≥90 (fast page load)
- Best Practices: ≥90 (no console errors)

**Common Issues to Fix**:
- Color contrast ratios (should be ≥4.5:1 for text)
- Touch target sizing (buttons ≥44x44px)
- ARIA labels for icon-only elements

---

## Step 9: Cross-Browser Testing

Test on multiple browsers:

| Browser | Version | Test URL | Expected Result |
|---------|---------|----------|-----------------|
| Chrome | Latest | http://localhost:3000/auth/signin | ✅ Full functionality |
| Firefox | Latest | http://localhost:3000/auth/signin | ✅ Full functionality |
| Safari | Latest | http://localhost:3000/auth/signin | ✅ Full functionality |
| Edge | Latest | http://localhost:3000/auth/signin | ✅ Full functionality |
| Mobile Safari | iOS 15+ | http://localhost:3000/auth/signin | ✅ Touch targets work |
| Chrome Android | Latest | http://localhost:3000/auth/signin | ✅ Touch targets work |

**How to Test Mobile**:
1. Start dev server: `npm run dev`
2. Find local IP: `ifconfig | grep inet`
3. Access from mobile: `http://<your-ip>:3000/auth/signin`
4. Verify touch targets are easy to tap (≥44x44px)

---

## Step 10: Type Checking and Linting

Before committing, run type checks and linter:

```bash
# TypeScript type checking
npm run type-check
# Should output: "Found 0 errors"

# ESLint
npm run lint
# Should output: "No ESLint warnings or errors"

# Prettier formatting
npm run format
# Should auto-fix formatting issues
```

---

## Common Issues and Solutions

### Issue: "react-icons not found"
**Solution**:
```bash
npm install react-icons
npm run dev # Restart dev server
```

### Issue: Header not showing on /auth/signin
**Solution**: Verify condition in `components/layout/header.tsx`:
```tsx
if (pathname?.startsWith('/auth') && pathname !== '/auth/signin') {
  return null;
}
```

### Issue: Card border not violet
**Solution**: Check Card className includes `border-[#8B5CF6] border-2`

### Issue: Background not dark
**Solution**: Verify auth layout uses `bg-[#1e1e2e]` not `bg-gray-50`

### Issue: Disabled buttons still clickable
**Solution**: Ensure `disabled` prop is set on Button component

---

## Performance Benchmarks

Expected performance after implementation:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Page Load | <2s | Chrome DevTools Network tab |
| First Contentful Paint | <1.5s | Lighthouse report |
| Largest Contentful Paint | <2.5s | Lighthouse report |
| Cumulative Layout Shift | <0.1 | Lighthouse report |
| Time to Interactive | <3s | Lighthouse report |

**How to Measure**:
```bash
# Start production build
npm run build
npm run start

# Open Chrome DevTools
# Navigate to http://localhost:3000/auth/signin
# Run Lighthouse audit (Performance category)
```

---

## Next Steps

After completing this implementation:

1. **Create Pull Request**: Use feature branch `041-sign-in-page`
2. **Request Review**: Tag reviewer with checklist completion
3. **Deploy Preview**: Vercel will auto-deploy preview for testing
4. **Merge to Main**: After approval, merge triggers production deploy

**Documentation**: Update `CLAUDE.md` if new patterns introduced

---

## Troubleshooting

### OAuth Flow Not Working
**Symptoms**: GitHub button doesn't redirect to GitHub

**Debugging**:
1. Check environment variables: `GITHUB_ID` and `GITHUB_SECRET` set in `.env.local`
2. Verify NextAuth.js config: `lib/auth.ts` has GitHub provider
3. Check console for errors during form submission
4. Verify callback URL in GitHub OAuth app settings: `http://localhost:3000/api/auth/callback/github`

**Solution**:
```bash
# Verify .env.local
cat .env.local | grep GITHUB
# Should show GITHUB_ID and GITHUB_SECRET

# Restart dev server
npm run dev
```

### TypeScript Errors
**Symptoms**: `Cannot find module 'react-icons/si'`

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## Resources

- **NextAuth.js Docs**: https://next-auth.js.org/
- **shadcn/ui Components**: https://ui.shadcn.com/
- **Catppuccin Theme**: https://github.com/catppuccin/catppuccin
- **react-icons**: https://react-icons.github.io/react-icons/
- **Playwright Testing**: https://playwright.dev/

---

## Summary

This quickstart covered:
1. ✅ Installing dependencies (`react-icons`)
2. ✅ Updating auth layout (dark theme)
3. ✅ Modifying header logic (show on /auth/signin)
4. ✅ Redesigning sign-in page (three OAuth providers)
5. ✅ Writing E2E tests (TDD approach)
6. ✅ Manual testing checklist
7. ✅ Accessibility audit
8. ✅ Cross-browser testing
9. ✅ Performance benchmarks

**Estimated Time**: 2-3 hours (including thorough testing)

**Ready for Implementation**: All research complete, tests written, design decisions documented.
