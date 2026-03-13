# Implementation Summary: BYOK - Bring Your Own API Key

**Branch**: `AIB-285-copy-of-byok` | **Date**: 2026-03-13
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented full BYOK feature: project owners can configure Anthropic and OpenAI API keys in project settings. Keys are encrypted at rest using AES-256-GCM, validated against provider APIs before saving, and automatically injected into workflow dispatch inputs. External projects without BYOK keys are blocked from running workflows. Backward compatibility preserved for ai-board self-management via empty-string fallback.

## Key Decisions

Used Node.js built-in `crypto` for AES-256-GCM encryption (no external deps). Passed decrypted keys as workflow dispatch inputs (simpler than managing GitHub repo secrets). Separate `ProjectAPIKey` model with `@@unique([projectId, provider])` constraint. Owner sees masked preview (last 4 chars); members see only configured status. Save-without-validation supported when provider API is unreachable (FR-014).

## Files Modified

- `prisma/schema.prisma` - Added ProjectAPIKey model, APIProvider enum
- `lib/encryption/api-keys.ts` - AES-256-GCM encrypt/decrypt
- `lib/db/api-keys.ts` - CRUD operations with encryption
- `lib/api-keys/validate.ts` - Format + live validation
- `lib/workflows/transition.ts` - BYOK key injection + external project check
- `app/api/projects/[projectId]/api-keys/` - GET, POST, DELETE, validate routes
- `components/settings/api-keys-card.tsx` - UI card with TanStack Query
- `app/projects/[projectId]/settings/page.tsx` - Added APIKeysCard
- 33 unit tests, 4 integration test files

## Manual Requirements

Run `bunx prisma migrate dev` to create the ProjectAPIKey table. Set `ENCRYPTION_MASTER_KEY` env var (64 hex chars) in production.
