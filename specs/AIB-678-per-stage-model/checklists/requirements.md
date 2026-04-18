# Specification Quality Checklist: Per-stage model configuration for Claude workflows

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed
- [x] Auto-Resolved Decisions section captures policy, confidence, trade-offs, and reviewer notes (or explicitly states none)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified
- [x] Any forced CONSERVATIVE fallbacks are documented with rationale

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/ai-board.clarify` or `/ai-board.plan`.
- AUTO policy was applied with High (0.85) confidence; no fallback to CONSERVATIVE was forced by low confidence. Each auto-resolved decision is logged in `spec.md` with policy, confidence, trade-offs, and reviewer notes.
- Out-of-scope job types (iterate, comment-*, health-scan, retro-spec, onboard) are explicitly excluded per the ticket; they remain on the global default.
- Reviewer attention suggested on:
  - Confirming "same auth rules as agent edit" includes project members alongside owners (spec adopts this).
  - UI copy for the dormant-state tooltip on the "Custom models" badge when a ticket's effective agent is not Claude.
