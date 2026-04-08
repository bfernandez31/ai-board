# Implementation Summary: Project Onboarding — Hybrid Workflow

**Branch**: `AIB-575-project-onboarding-hybrid` | **Date**: 2026-04-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced stub onboard.yml with a real two-phase hybrid onboarding workflow. Phase 1 uses detect-stack.sh for deterministic stack detection across 7 language ecosystems (TypeScript, Python, Rust, Go, Java/Kotlin, Ruby, PHP), producing config.yml + analysis.json. Phase 2 invokes an LLM agent to generate CLAUDE.md and constitution.md. Supports partial success, idempotent re-onboarding, and structured error codes (DISPATCH_FAILED, CONFIG_GENERATION_FAILED, GUIDANCE_GENERATION_FAILED, COMMIT_FAILED).

## Key Decisions

Extended existing config schema enums (ruby, php, bundler, composer, rails, laravel, rspec, phpunit, actix, rocket) rather than creating a separate onboarding schema. Used pure bash + jq for detection (no external deps). Implemented all 5 user stories holistically in a single workflow file to avoid redundant partial implementations. Tests use temporary fixture directories with child_process.execSync.

## Files Modified

- `.github/scripts/detect-stack.sh` (CREATE) — Phase 1 detection script
- `.github/workflows/onboard.yml` (MODIFY) — Two-phase workflow replacing stub
- `.claude-plugin/commands/ai-board.onboard.md` (CREATE) — Phase 2 agent command
- `lib/validations/config.ts` (MODIFY) — Extended enums
- `specs/AIB-449-define-ai-board/contracts/config-schema.ts` (MODIFY) — Extended type unions
- `tests/unit/detect-stack.test.ts` (CREATE) — 16 tests for detection script
- `tests/unit/config-schema.test.ts` (MODIFY) — 7 new enum validation tests

## Manual Requirements

None
