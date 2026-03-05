# Quickstart: Pass Agent Selection Through Workflow Dispatch Pipeline

**Branch**: `AIB-230-pass-agent-selection` | **Date**: 2026-03-05

## Overview

Add agent selection propagation to all workflow dispatch calls. The resolved agent value (ticket override > project default > CLAUDE fallback) must reach every workflow that invokes an agent CLI.

## Implementation Order

### Step 1: Add `resolveEffectiveAgent()` utility

**File**: `lib/workflows/transition.ts`

Add a pure function that resolves the effective agent from the ticket/project chain. This is the foundation all dispatch modifications depend on.

### Step 2: Update `handleTicketTransition()` dispatch payloads

**File**: `lib/workflows/transition.ts`

- Add `agent` to `quickImplPayload` JSON (line ~212)
- Add `agent` to `specifyPayload` JSON (line ~255)
- Add `agent` to verify workflow inputs (line ~235)
- Add `agent` to speckit generic workflow inputs (line ~246) for PLAN and BUILD commands

### Step 3: Update `dispatchAIBoardWorkflow()` interface and dispatch

**File**: `app/lib/workflows/dispatch-ai-board.ts`

- Add `agent` to `AIBoardWorkflowInputs` interface
- Add `agent` to dispatch inputs object

### Step 4: Update cleanup dispatch

**File**: `app/api/projects/[projectId]/clean/route.ts`

- Resolve agent from project default (cleanup tickets don't have per-ticket agent overrides since they're auto-created)
- Add `agent` to cleanup dispatch inputs

### Step 5: Update workflow YAML files

**Files**: `.github/workflows/verify.yml`, `cleanup.yml`, `ai-board-assist.yml`, `iterate.yml`

- Add `agent` input declaration to each workflow
- No changes needed for speckit.yml and quick-impl.yml (agent embedded in JSON payloads)

### Step 6: Update verify → iterate propagation

**File**: `.github/workflows/verify.yml`

- Forward `agent` input when dispatching iterate.yml via `gh workflow run`

### Step 7: Write tests

**Type**: Vitest integration tests
**File**: `tests/integration/tickets/agent-dispatch.test.ts` (new) or extend existing transition tests

- Test agent resolution: ticket override, project fallback, system default
- Test payload construction includes agent for each workflow type
- Test dispatch helper interfaces accept agent parameter

## Key Constraints

- speckit.yml stays at 9 inputs (agent embedded in specifyPayload JSON)
- ai-board-assist.yml goes to 10 inputs (maximum allowed)
- No database migrations required
- No UI changes required
