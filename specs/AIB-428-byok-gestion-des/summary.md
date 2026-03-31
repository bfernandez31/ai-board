# Implementation Summary: BYOK - User API Key Management for AI Agents

**Branch**: `AIB-428-byok-gestion-des` | **Date**: 2026-03-31
**Spec**: [spec.md](spec.md)

## Changes Summary

Full BYOK implementation: users can add/test/delete encrypted AI credentials (Anthropic API keys or OAuth tokens) via Settings page. Workflows automatically fetch and use the project owner's credential at runtime. AES-256-GCM encryption at rest, format validation, provider verification, readiness status tracking. 44 tests (14 unit, 23 integration, 7 component).

## Key Decisions

- Added `/api/internal/credentials` to proxy.ts PUBLIC_PATTERNS to allow workflow Bearer token auth to bypass NextAuth session check. Owner-based resolution: project -> owner userId -> UserCredential. Workflow YAML steps fall back to repository secrets if no owner credential exists. Credential type determines env var: API_KEY -> ANTHROPIC_API_KEY, OAUTH_TOKEN -> CLAUDE_CODE_OAUTH_TOKEN.

## Files Modified

- `prisma/schema.prisma` — UserCredential model + 3 enums
- `lib/ai-credentials/` — crypto, types, service, workflow, providers/anthropic
- `app/api/credentials/` — GET/POST/DELETE/test routes
- `app/api/internal/credentials/` — workflow credential endpoint
- `app/settings/credentials/page.tsx` — settings page
- `components/credentials/` — form, list, item, test-button, delete-dialog
- `lib/hooks/mutations/useCredentials.ts` — TanStack Query hooks
- `components/auth/user-menu.tsx` — nav link
- `.github/workflows/ai-board-assist.yml`, `speckit.yml` — credential fetch steps
- `app/lib/workflows/dispatch-ai-board.ts` — pre-dispatch guard
- `proxy.ts` — public pattern for internal endpoint

## Manual Requirements

Set `CREDENTIAL_ENCRYPTION_KEY` env var in production (32-byte hex: `openssl rand -hex 32`). Already configured in .env.local and .env for dev/test.
