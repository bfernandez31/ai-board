# Quickstart: Legal Pages - Terms of Service & Privacy Policy

**Branch**: `AIB-255-copy-of-legal` | **Date**: 2026-03-11

## Implementation Order

### Step 1: Create Footer Component

Create `/components/layout/footer.tsx` with links to `/legal/terms` and `/legal/privacy`. Use existing Catppuccin Mocha color palette and Tailwind utilities. Include copyright notice with current year.

### Step 2: Add Footer to Root Layout

Update `/app/layout.tsx` to render `<Footer />` after `{children}`, before `<Toaster />`.

### Step 3: Create Terms of Service Page

Create `/app/legal/terms/page.tsx` as a Server Component with static content covering all FR-003 sections. Include effective date per FR-008.

### Step 4: Create Privacy Policy Page

Create `/app/legal/privacy/page.tsx` as a Server Component with static content covering all FR-004 sections. Include effective date per FR-008.

### Step 5: Update Sign-In Page

Update `/app/auth/signin/page.tsx` to add consent notice with links to both legal pages per FR-006.

### Step 6: Write Tests

- Integration test: Verify legal pages return 200 and contain required sections
- Component test: Verify Footer renders with correct links
- Component test: Verify sign-in page consent notice

## Key Files

| File | Action | Purpose |
|------|--------|---------|
| `/components/layout/footer.tsx` | CREATE | Global footer component |
| `/app/legal/terms/page.tsx` | CREATE | Terms of Service page |
| `/app/legal/privacy/page.tsx` | CREATE | Privacy Policy page |
| `/app/layout.tsx` | MODIFY | Add Footer to root layout |
| `/app/auth/signin/page.tsx` | MODIFY | Add consent notice |
| `/tests/unit/components/footer.test.tsx` | CREATE | Footer component test |
| `/tests/integration/legal/pages.test.ts` | CREATE | Legal page integration tests |

## Dependencies

- No new npm packages required
- No database migrations
- No environment variables
- No Prisma schema changes

## Verification

```bash
bun run type-check    # Must pass
bun run lint          # Must pass
bun run test:unit     # Footer component test
bun run test:integration  # Legal page integration tests
```
