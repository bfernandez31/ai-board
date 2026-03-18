# Quick Implementation: Dev Login for preview environments

**Feature Branch**: `AIB-312-dev-login-for`
**Created**: 2026-03-18
**Mode**: Quick Implementation

## Description

Preview deployments on Vercel have random URLs per deploy, making GitHub OAuth unusable. Added a Credentials-based login (email + shared secret) that only exists when `DEV_LOGIN_SECRET` env var is set.

## Changes

- `lib/auth.ts`: Added conditional Credentials provider and signIn callback handling
- `app/lib/auth/user-service.ts`: Added `createOrUpdateDevUser()` function
- `app/auth/signin/page.tsx`: Conditionally renders DevLoginForm
- `app/auth/signin/dev-login-form.tsx`: New client component for dev login form
- `tests/unit/auth/user-service.test.ts`: Added 3 tests for createOrUpdateDevUser

## Environment Variables

- `DEV_LOGIN_SECRET`: Server-side secret — enables the Credentials provider
- `NEXT_PUBLIC_DEV_LOGIN=true`: Client-side flag — shows the dev login form
