# Implementation Summary: Dev Login for Preview Environments

**Branch**: `AIB-313-dev-login-for` | **Date**: 2026-03-18
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented preview-only dev login with a gated Auth.js credentials provider, shared validation/provisioning helper, sign-in form and generic failure UX, callback redirect normalization, and auth-focused unit, integration, and browser coverage for enabled, disabled, success, and failure scenarios.

## Key Decisions

Used one shared availability predicate for both UI and credentials authorization, provisioned users transactionally by normalized email with a credentials `Account` upsert, normalized direct callback failures in the auth route to `error=dev-login`, and kept GitHub auth behavior intact outside preview mode.

## Files Modified

`app/lib/auth/dev-login.ts`, `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/auth/signin/page.tsx`, `app/auth/error/page.tsx`, `specs/AIB-313-dev-login-for/tasks.md`, `specs/AIB-313-dev-login-for/summary.md`, `tests/unit/auth/dev-login-*.ts`, `tests/unit/components/sign-in-page-*.tsx`, `tests/integration/auth/dev-login-*.ts`, `tests/e2e/auth/dev-login.spec.ts`

## ⚠️ Manual Requirements

None
