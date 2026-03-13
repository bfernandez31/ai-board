# Implementation Summary: BYOK - Bring Your Own API Key

**Branch**: `AIB-247-byok-bring-your` | **Date**: 2026-03-13
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented full BYOK feature allowing project owners to securely store, validate, and use their own API keys (Anthropic, OpenAI). Keys are encrypted at rest with AES-256-GCM, masked in UI (last 4 chars), and injected into workflow dispatches. Workflows are blocked with actionable errors when keys are missing. Members see configuration status in read-only mode.

## Key Decisions

- Used Node.js native `crypto` module for AES-256-GCM (no external dependencies)
- Encryption format: `iv:authTag:ciphertext` (hex-encoded, stored in single DB column)
- API key injected as workflow input with `::add-mask::` for log protection
- Ownership determined server-side in settings page for owner/member UI split
- All CRUD operations use Prisma upsert pattern for key replacement

## Files Modified

- `prisma/schema.prisma` - Added ApiKeyProvider enum, ProjectApiKey model
- `lib/crypto/encryption.ts` - AES-256-GCM encrypt/decrypt
- `lib/validation/api-key-formats.ts` - Provider format validation
- `lib/db/api-keys.ts` - Database CRUD operations
- `app/api/projects/[projectId]/api-keys/` - GET, POST, DELETE, validate routes
- `components/settings/api-keys-card.tsx` - Settings UI card
- `app/projects/[projectId]/settings/page.tsx` - Settings page integration
- `lib/workflows/transition.ts` - Key injection at dispatch
- `.github/workflows/{speckit,quick-impl,verify}.yml` - API key inputs + masking

## Manual Requirements

Set `API_KEY_ENCRYPTION_KEY` environment variable (64 hex chars) in production. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
