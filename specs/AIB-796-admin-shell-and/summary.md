# Implementation Summary: Admin shell and access entry in user menu

**Branch**: `AIB-796-admin-shell-and` | **Date**: 2026-05-12
**Spec**: [spec.md](spec.md)

## Changes Summary

Surface the admin space to allowlisted operators via a server-gated "Admin" entry in the avatar dropdown and mobile sheet, and replace the AIB-791 placeholder shell with a Client `AdminShell` (Espace admin sidebar, V1 items Accueil + Insights LLM, divider, "Retour à l'app"). `getViewerIsAdmin` resolves once per render in the root layout; the boolean threads down to `Header → UserMenu / MobileMenu`. `requireAdminPageOrNotFound` remains the canonical guard.

## Key Decisions

`isAdmin` resolves server-side and is passed down via prop (D-1/D-9, no Context). Pure `isAdminItemActive(pathname, href)` matcher with explicit root carve-out for `/admin` (FR-009, D-3). Shell is the single new Client Component (justified by `usePathname`). No new deps, no DB changes, no new env vars. The `/admin → /admin/insights` redirect (FR-018) is preserved.

## Files Modified

Created: `lib/admin/active-path.ts`, `components/admin/admin-shell.tsx`, `components/admin/admin-sidebar-items.ts`, `tests/unit/lib/admin/active-path.test.ts`, `tests/unit/components/admin/admin-shell.test.tsx`, `tests/integration/admin-shell-isolation.test.ts`. Modified: `app/layout.tsx`, `app/lib/auth/admin.ts`, `app/admin/layout.tsx`, `components/layout/header.tsx`, `components/auth/user-menu.tsx`, `components/layout/mobile-menu.tsx`, plus 3 existing unit tests extended.

## ⚠️ Manual Requirements

None. Verified by 53 unit tests (`admin.test.ts`, `active-path.test.ts`, header/menu/admin-shell suites) and 2 integration tests (admin-shell isolation + AIB-791 404 parity regression gate). `type-check` and `lint` clean.
