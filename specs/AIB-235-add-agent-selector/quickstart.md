# Quickstart: Add Agent Selector UI

**Feature**: AIB-235 | **Branch**: `AIB-235-add-agent-selector`

## Implementation Order

### Phase 1: Foundation Utility
1. Create `app/lib/utils/agent-icons.ts` — icon, label, description helpers for Agent enum
2. Write unit tests for the utility

### Phase 2: Project Settings
3. Create `components/settings/default-agent-card.tsx` — mirror ClarificationPolicyCard
4. Add `<DefaultAgentCard>` to `app/projects/[projectId]/settings/page.tsx`
5. Write component test for DefaultAgentCard

### Phase 3: Ticket Creation
6. Add agent `<Select>` field to `components/board/new-ticket-modal.tsx`
7. Extend existing new-ticket-modal tests

### Phase 4: Ticket Detail & Editing
8. Create `components/tickets/agent-edit-dialog.tsx` — mirror PolicyEditDialog
9. Add AgentBadge + "Edit Agent" button + AgentEditDialog to `components/board/ticket-detail-modal.tsx`
10. Write component test for AgentEditDialog

### Phase 5: Board Display
11. Add agent badge to `components/board/ticket-card.tsx` header row
12. Extend existing ticket card tests

### Phase 6: Quick-Impl Modal
13. Extend `components/board/quick-impl-modal.tsx` with agent selector
14. Update parent components that call QuickImplModal to pass agent props
15. Extend existing quick-impl tests

## Key Patterns to Follow

| Pattern | Reference File |
|---------|---------------|
| Settings card with Select | `components/settings/clarification-policy-card.tsx` |
| Icon/label utility | `app/lib/utils/policy-icons.ts` |
| Form field in creation modal | `components/board/new-ticket-modal.tsx` (lines 289-335) |
| Edit dialog for ticket fields | Search for `PolicyEditDialog` in `ticket-detail-modal.tsx` |
| Badge on ticket cards | `components/board/ticket-card.tsx` (lines 124-142) |

## Validation Checklist

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run test:unit` passes (new + existing)
- [ ] Agent dropdown shows project default in new ticket modal
- [ ] Agent badge visible on board ticket cards
- [ ] Agent editable only in INBOX stage
- [ ] Settings card persists defaultAgent change
- [ ] Quick-impl modal includes agent selector
