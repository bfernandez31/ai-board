# Implementation Summary: Legal Pages - Terms of Service & Privacy Policy

**Branch**: `AIB-255-copy-of-legal` | **Date**: 2026-03-11
**Spec**: [spec.md](spec.md)

## Changes Summary

Added Terms of Service (/legal/terms) and Privacy Policy (/legal/privacy) as static Server Components with all required content sections (FR-003, FR-004) and effective dates (FR-008). Created global Footer component with legal links rendered on all pages via root layout. Added consent notice with legal links below OAuth buttons on sign-in page. Includes unit test for Footer and integration tests for legal page routes.

## Key Decisions

- Footer uses `next/link` for client-side navigation, styled with existing Catppuccin Mocha palette
- Legal pages are static Server Components with no data fetching for fast load times
- Sign-in consent uses informational links (not checkbox) per spec auto-resolved decision
- No new dependencies added; all styling via existing Tailwind utilities

## Files Modified

- `components/layout/footer.tsx` (CREATE): Global footer with legal links and copyright
- `app/legal/terms/page.tsx` (CREATE): Terms of Service page with FR-003 sections
- `app/legal/privacy/page.tsx` (CREATE): Privacy Policy page with FR-004 sections
- `app/layout.tsx` (MODIFY): Added Footer after children
- `app/auth/signin/page.tsx` (MODIFY): Added consent notice with legal links
- `tests/unit/components/footer.test.tsx` (CREATE): Footer component test (3 tests)
- `tests/integration/legal/pages.test.ts` (CREATE): Legal page integration tests (4 tests)

## Manual Requirements

None
