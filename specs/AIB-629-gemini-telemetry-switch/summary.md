# Implementation Summary: Gemini Telemetry — Switch to Native OTLP

**Branch**: `AIB-629-gemini-telemetry-switch` | **Date**: 2026-04-13
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced Gemini's batch telemetry (stream-JSON scraping → jq → curl) with native OTLP emission. Added `gemini_cli.api_response` and `gemini_cli.tool_call`/`tool_result` handlers to the telemetry endpoint. Removed `collect_gemini_telemetry()` and `--output-format stream-json` from the agent script. Simplified batch handler to Mistral-only by removing `agent`, `usageSnapshotMode` fields and Gemini-specific normalization. Updated AIB-626 docs to mark batch approach as superseded.

## Key Decisions

Followed the Codex OTLP pattern for Gemini handler: accumulate tokens via `parseIntAttribute`, estimate cost server-side using existing `estimateGeminiCost()` via `geminiCostModel` field. Thinking tokens use additive accumulation only when non-zero to preserve null semantics. Batch handler simplified in-place rather than creating a separate Mistral handler.

## Files Modified

- `app/api/telemetry/v1/logs/route.ts` — Added Gemini OTLP handler, simplified batch to Mistral-only
- `.github/scripts/run-agent.sh` — Removed stream-json, collect_gemini_telemetry, simplified dispatch
- `tests/integration/telemetry/agent-agnostic.test.ts` — Replaced batch tests with OTLP tests, added failure-path tests
- `specs/AIB-626-fix-gemini-telemetry/` — Marked 4 docs as superseded by AIB-629
- `specs/AIB-629-gemini-telemetry-switch/tasks.md` — All tasks marked complete

## Manual Requirements

None
