# Quick Implementation: Inbox analysis panel - make it discreet by default

**Feature Branch**: `AIB-757-inbox-analysis-panel`
**Created**: 2026-04-29
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

The inbox analysis section in the ticket detail modal is too imposing for what is an *optional* feature. It dominates the Details tab whether or not an analysis exists:

- **Empty state** still renders a full header strip with a label and an Analyze button that loudly displays the cost
- **Success state** renders a ~700px-tall card with friction risk, quality gate range, a multi-sentence justification paragraph, cost breakdown, scope warnings, and an anchor list - all expanded by default
- **Running state** adds yet another card *below* the trigger row instead of replacing it
- **"Description changed - Re-analyze"** banner adds another full-width strip when stale
- The chips ("low friction", "high confidence", "QUICK") are not self-explanatory; users have no way to learn what they mean without reading the spec

The analysis is a helpful signal, but its visual weight is disproportionate to its role.

## Expected behaviour

The whole panel should collapse to a single line by default, regardless of state, and reveal details on demand.

### Collapsed line, by state

| State | Line content |
|---|---|
| Triggerable, no analysis yet | A small `Run analysis` action aligned to the right. No "INBOX ANALYSIS" label, no inline cost. |
| Not triggerable, no analysis | Nothing rendered. (The current "No analysis available." text is removed.) |
| Running | `Analyzing...` with a spinner, on the same line. No additional block underneath. |
| Failed | `Analysis failed - Retry`, on a single line. The error message is available via tooltip on the warning icon. |
| Cold start | `Cold start - not enough comparable tickets`, with an expand control to reveal scope warnings. |
| Success (collapsed) | Three coloured chips side-by-side - recommendation choice (QUICK/FULL), friction risk (low/medium/high), confidence (low/medium/high) - followed by meta `analyzed N ago` and an expand control. |
| Success + stale (description changed since analysis) | Same as Success, plus a visual "stale" indicator on the icon and a re-analyze action inline on the row. The standalone "Description changed" banner is no longer rendered. |

### Expanded view

When the user expands the line, the following appear below it: the recommendation justification paragraph, quality gate range, cost range, scope warnings (when present), and the anchor citation list. All existing data shown today must remain accessible - only its default visibility changes.

### Tooltips for clarity

Every chip and meta element must have a tooltip explaining what it means in plain language:

- **Recommendation chip**: explains what QUICK vs FULL workflow means and when each is preferred
- **Friction risk chip**: explains that the score estimates implementation difficulty based on similar shipped tickets (anchors)
- **Confidence chip**: explains that confidence reflects how many similar anchors were found
- **`analyzed N ago` meta**: shows the full timestamp and the actual cost paid for the analysis
- **Failed icon**: shows the full error message
- **Run analysis button (empty state)**: shows the estimated cost range - this is the *only* place the cost should appear; it should not be visible on the button label itself

### Re-analyze when stale

When the ticket description has changed since the latest analysis, the row indicates staleness and exposes a one-click re-analyze action. The behaviour and trigger are identical to today's "Description changed" banner; only the presentation changes.

## Acceptance criteria

- The collapsed panel occupies roughly one line of vertical space (~32px) in every state, including running and failed
- No state renders more than one row when collapsed
- The Analyze button no longer shows the cost in its label; the cost appears only on hover
- The standalone "Description changed - Re-analyze" banner is removed; the re-analyze action lives inline on the analysis row
- Each chip (recommendation, friction risk, confidence) shows a tooltip on hover with a plain-language explanation of what the value means
- The full content available today (justification, quality gate range, cost range, scope warnings, anchors) remains accessible after expanding the row - nothing is removed
- Post-INBOX tickets that have never been analysed render nothing at all, instead of "No analysis available."
- Existing analysis behaviour, polling, and API contracts are unchanged - this is a presentation-only change

## Out of scope

- Changes to the analysis output schema or API
- Changes to the polling cadence or the `useTicketAnalysis` hook
- Redesign of the anchor citation list itself (only its placement changes)

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
