# Implementation Summary: Add Agent Selector UI on Tickets and Project Settings

**Branch**: `236-add-agent-selector` | **Date**: 2026-03-04
**Spec**: [spec.md](spec.md)

## Changes Summary

Added agent selector UI across all application views, mirroring the existing clarification policy pattern. Includes: DefaultAgentCard in project settings, agent dropdown in new ticket modal, AgentEditDialog with badge in ticket detail modal (INBOX-only editing), agent badge on kanban board ticket cards, and agent selector in quick-impl modal. All backed by 13 passing unit/component tests.

## Key Decisions

Mirrored clarification policy UI pattern exactly (ClarificationPolicyCard -> DefaultAgentCard, PolicyEditDialog -> AgentEditDialog, PolicyBadge pattern -> Badge with agent info). Used "project-default" sentinel value in Select components to distinguish between explicit agent selection and project default inheritance. Agent badge shows muted styling with "(default)" suffix for inherited agents.

## Files Modified

**New**: app/lib/utils/agent-icons.ts, components/settings/default-agent-card.tsx, components/tickets/agent-edit-dialog.tsx, tests/unit/agent-icons.test.ts, tests/unit/components/default-agent-card.test.tsx, tests/unit/components/agent-edit-dialog.test.tsx
**Modified**: app/projects/[projectId]/settings/page.tsx, components/board/board.tsx, components/board/new-ticket-modal.tsx, components/board/quick-impl-modal.tsx, components/board/ticket-card.tsx, components/board/ticket-detail-modal.tsx

## Manual Requirements

None
