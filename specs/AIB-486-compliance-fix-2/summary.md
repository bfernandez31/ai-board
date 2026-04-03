# Implementation Summary: [Compliance] Fix 2 violations - Security-First Design

**Branch**: `AIB-486-compliance-fix-2` | **Date**: 2026-04-03
**Spec**: [spec.md](spec.md)

## Changes Summary

Fixed two Security-First Design compliance violations: (1) Service credentials (`username`, `password`) are now stripped from config before DB storage and API response via `stripServiceCredentials()`. (2) Replaced `.passthrough()` with `.strict()` on all config schemas so unknown fields are rejected with descriptive validation errors instead of silently persisted.

## Key Decisions

Used `flatMap` in `mapZodErrors()` to handle `unrecognized_keys` issues that can contain multiple unknown keys per Zod issue. Kept `username`/`password` in `ServiceConfigSchema` for validation but strip post-validation, matching the existing `env` stripping pattern.

## Files Modified

- `lib/validations/config.ts` — Added `.strict()` to all schemas, `stripServiceCredentials()` export, `unrecognized_keys` handling in `mapZodErrors()`
- `lib/config-sync.ts` — Integrated `stripServiceCredentials()` alongside env stripping before DB write
- `tests/unit/config-schema.test.ts` — Updated unknown-field tests (errors not warnings), added credential stripping unit tests
- `tests/integration/projects/config-sync.test.ts` — Added credential stripping integration test
- `specs/AIB-486-compliance-fix-2/tasks.md` — All 17 tasks marked complete

## Manual Requirements

None
