# Quick Implementation: Personal Access Tokens for API Authentication

**Feature Branch**: `AIB-183-personal-access-tokens`
**Created**: 2026-01-23
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Add a Personal Access Token (PAT) system to allow external tools to authenticate with the ai-board API. This enables programmatic access for CLI tools, MCP servers, and other integrations.

## Purpose
Currently, ai-board uses session-based authentication (NextAuth.js) which only works in browsers. To enable:
- MCP servers (Claude integration for direct ticket creation)
- CLI tools
- CI/CD integrations
- Third-party automations

We need token-based API authentication.

## User Value
- Generate tokens to connect external tools to ai-board
- Manage multiple tokens (one per tool/device)
- Revoke tokens without affecting other integrations
- See when tokens were last used

## Requirements

### Token Management UI
- Location: User settings page (`/settings/tokens` or section in existing settings)
- List all user's tokens with: name, created date, last used date, partial token preview
- "Generate new token" button opens modal
- Token generation modal: name input (e.g., "My MCP", "CI Pipeline")
- After generation: show full token ONCE (user must copy it, cannot retrieve later)
- Delete button per token with confirmation

### Token Format
- Prefix: `pat_` for easy identification
- Random secure string (32+ characters)
- Example: `pat_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### API Authentication
- Accept header: `Authorization: Bearer pat_xxxxx`
- Validate token and resolve to user
- Update `lastUsedAt` on each use
- Return 401 Unauthorized for invalid/expired tokens
- Works alongside existing session auth (both methods supported)

### Data Model
New table `PersonalAccessToken`:
- id (primary key)
- userId (foreign key to User)
- name (string, user-provided label)
- tokenHash (string, hashed token - never store plain text)
- tokenPreview (string, last 4 chars for display: "...o5p6")
- createdAt (datetime)
- lastUsedAt (datetime, nullable)

### Security
- Tokens hashed before storage (bcrypt or similar)
- Plain token shown only once at creation
- Tokens scoped to user (same permissions as session)
- Rate limiting on token endpoints

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

Implementation will be done directly by Claude Code based on the description above.
