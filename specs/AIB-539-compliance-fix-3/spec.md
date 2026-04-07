# [Compliance] Fix 3 violations - Error Handling

## Description

Health scan found 3 compliance violations for principle "Error Handling":

1. `lib/workflows/transition.ts:336`: Empty catch `.catch(() => {})` silently swallows job deletion error
2. `lib/workflows/transition.ts:366`: Outer catch masks original error with generic message
3. `app/api/projects/[projectId]/health/route.ts:158`: Empty catch block on JSON parse

## Implementation

- Replace empty catches with logged warnings
- Return actionable error messages from outer catch
- Log parse errors in health route
