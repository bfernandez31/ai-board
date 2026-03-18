# Quick Implementation: Dev Login for preview environments (Credentials provider)

**Feature Branch**: `AIB-315-dev-login-for`
**Created**: 2026-03-18
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Preview deployments on Vercel have random URLs per deploy, making GitHub OAuth unusable. Added a Credentials-based login (email + shared secret) that only exists when `DEV_LOGIN_SECRET` env var is set.

## Implementation

### Files Modified
- `lib/auth.ts` — Added Credentials provider conditionally, allow dev-login in signIn callback
- `app/lib/auth/user-service.ts` — Added `createOrUpdateDevUser()` with deterministic ID from email hash
- `app/auth/signin/page.tsx` — Conditionally renders DevLoginForm component
- `components/auth/dev-login-form.tsx` — New client component with email + secret form
- `tests/unit/auth/user-service.test.ts` — 3 new tests for createOrUpdateDevUser

### Environment Variables
- `DEV_LOGIN_SECRET` (server-side): Shared secret, enables the Credentials provider
- `NEXT_PUBLIC_DEV_LOGIN=true` (client-side): Shows the dev login form on the signin page
