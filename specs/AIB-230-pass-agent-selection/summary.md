# Implementation Summary: Pass Agent Selection Through Workflow Dispatch Pipeline

**Branch**: `AIB-230-pass-agent-selection` | **Date**: 2026-03-05
**Spec**: [spec.md](spec.md)

## Changes Summary

Added `resolveEffectiveAgent()` utility (ticket.agent > project.defaultAgent > CLAUDE fallback) and propagated the resolved agent value through all workflow dispatch calls. Uses mixed strategy: agent embedded in JSON payloads for speckit.yml and quick-impl.yml, discrete `agent` input for verify, cleanup, ai-board-assist, and iterate workflows. Also updated ai-board-assist.yml to forward agent when dispatching iterate.yml.

## Key Decisions

- Mixed dispatch strategy: embed in existing JSON payloads (specifyPayload, quickImplPayload) where they exist, add discrete workflow input where they don't. This keeps speckit.yml at 10 inputs and ai-board-assist.yml at exactly 10 inputs (GitHub Actions maximum).
- Added `agent` as a discrete input to speckit.yml for PLAN/BUILD commands since specifyPayload is only sent for SPECIFY.

## Files Modified

- `lib/workflows/transition.ts` - resolveEffectiveAgent() + agent in all dispatch payloads
- `app/lib/workflows/dispatch-ai-board.ts` - AIBoardWorkflowInputs interface + dispatch
- `app/api/projects/[projectId]/clean/route.ts` - cleanup dispatch with agent
- `app/api/projects/[projectId]/tickets/[id]/comments/route.ts` - AI-BOARD dispatch with agent
- `.github/workflows/verify.yml` - agent input declaration
- `.github/workflows/cleanup.yml` - agent input declaration
- `.github/workflows/ai-board-assist.yml` - agent input + forward to iterate
- `.github/workflows/iterate.yml` - agent input declaration
- `.github/workflows/speckit.yml` - agent input declaration

## Manual Requirements

None
