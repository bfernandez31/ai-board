# Implementation Summary: Dev Login for Preview Environments

**Branch**: `AIB-311-dev-login-for` | **Date**: 2026-03-18
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented conditional Credentials provider for NextAuth, gated on DEV_LOGIN_SECRET env var. Added DevLoginForm client component with email/secret inputs, timing-safe secret comparison via crypto.timingSafeEqual with buffer padding, deterministic user ID (SHA-256 of lowercase email), and createOrUpdateDevUser upsert function. Signin page conditionally renders dev login form when NEXT_PUBLIC_DEV_LOGIN=true. 14 tests pass (10 unit, 4 component).

## Key Decisions

- Moved auth tests from tests/integration/ to tests/unit/ since they mock Prisma and don't need a running server
- Used Buffer.alloc padding for timing-safe comparison of different-length secrets to prevent timing leaks on length
- DevLoginForm uses client-side signIn() from next-auth/react with redirect:false for inline error handling
- createOrUpdateDevUser only updates updatedAt on existing users, preserving name/image from GitHub OAuth

## Files Modified

- `lib/auth.ts` — Added Credentials provider, devLoginProvider(), updated signIn callback
- `app/lib/auth/user-service.ts` — Added createOrUpdateDevUser function
- `components/auth/dev-login-form.tsx` — New DevLoginForm client component
- `app/auth/signin/page.tsx` — Conditional DevLoginForm rendering
- `.env.example` — Added DEV_LOGIN_SECRET and NEXT_PUBLIC_DEV_LOGIN
- `tests/unit/auth/dev-login.test.ts` — 10 unit tests for auth logic
- `tests/unit/components/dev-login-form.test.tsx` — 4 component tests

## ⚠️ Manual Requirements

Set DEV_LOGIN_SECRET (32+ chars) and NEXT_PUBLIC_DEV_LOGIN=true in preview environment variables (Vercel/hosting provider). Do NOT set these in production.
