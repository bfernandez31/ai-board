# Quick Implementation: BYOK - Bring Your Own API Key

**Feature Branch**: `AIB-282-byok-bring-your`
**Created**: 2026-03-13
**Mode**: Quick Implementation

## Description

Allow users to provide their own API keys for AI agents (Claude, Codex) so AI costs are on their side.

### Requirements
- In project settings, users can add API keys (Anthropic Claude, OpenAI Codex)
- Keys stored encrypted at-rest (never plaintext in DB)
- Keys masked in UI after entry (show only last 4 characters)
- Users can test key validity
- Users can delete/replace keys at any time
- Workflows use project key for API calls
- If no key configured, workflows cannot launch with explicit message

### Security
- Encryption at-rest for keys
- Keys must never appear in logs
- Keys never transit client-side after initial entry
