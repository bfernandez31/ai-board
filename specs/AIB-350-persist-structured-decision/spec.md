# Quick Implementation: Persist structured decision points in comparison data

**Feature Branch**: `AIB-350-persist-structured-decision`
**Created**: 2026-03-26
**Mode**: Quick Implementation (bypassing formal specification)

## Description

In the comparison dialog, the "Decision Points" section showed identical content for every accordion item — same summary, same rationale, same per-ticket approach ("X files changed"). Only the title differed. Now each decision point displays distinct data from the AI's structured analysis.

## Changes

### 1. Type System (`lib/types/comparison.ts`)
- Added `ReportDecisionPoint` interface with `title`, `winner`, `rationale`, and `approaches`
- Added optional `decisionPoints?: ReportDecisionPoint[]` field to `ComparisonReport`

### 2. Zod Validation (`lib/comparison/comparison-payload.ts`)
- Added `reportDecisionPointSchema` for validating structured decision points
- Added optional `decisionPoints` field to `serializedComparisonReportSchema`

### 3. Persistence (`lib/comparison/comparison-record.ts`)
- Extracted existing logic to `buildDecisionPointsFallback` for backwards compatibility
- New `buildDecisionPoints` checks for `report.decisionPoints` first, falls back to legacy behavior

### 4. Compare Command Template (`.claude-plugin/commands/ai-board.compare.md`)
- Added `decisionPoints` array to the JSON template in Step 10.5
- Added field rule requiring `decisionPoints` with structured data from Step 7 analysis

## Acceptance Criteria
- [x] Each decision point shows unique title, rationale, verdict, and per-ticket approaches
- [x] Structured decision point data included in comparison JSON payload
- [x] Existing comparisons without new data continue to display with fallback behavior
- [x] Compare command template instructs AI to include structured decision points
