# Research: Add SPECIFY Stage to Kanban Workflow

**Date**: 2025-10-02
**Feature**: 006-specify-add-specify

## Research Findings

This document captures research findings from the existing codebase to ensure the SPECIFY stage implementation follows established patterns and conventions.

---

## 1. Existing Stage Enum Pattern

**Question**: How is the current Stage enum defined and used?

**Investigation**: Reviewed `prisma/schema.prisma` and `/lib/stage-validation.ts`

**Current Implementation**:

**Prisma Schema** (`prisma/schema.prisma:13-19`):
```prisma
enum Stage {
  INBOX
  PLAN
  BUILD
  VERIFY
  SHIP
}
```

**TypeScript Enum** (`lib/stage-validation.ts:8-14`):
```typescript
export enum Stage {
  INBOX = 'INBOX',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
}
```

**Stage Order** (`lib/stage-validation.ts:20-26`):
```typescript
const STAGE_ORDER: Stage[] = [
  Stage.INBOX,
  Stage.PLAN,
  Stage.BUILD,
  Stage.VERIFY,
  Stage.SHIP,
];
```

**Decision**: Add SPECIFY between INBOX and PLAN in all three locations:
- Prisma schema enum
- TypeScript enum in `lib/stage-validation.ts`
- STAGE_ORDER array (insert at index 1)

**Rationale**: Dual enum pattern ensures type safety across database and application layers. Order matters for sequential validation logic.

---

## 2. Current Transition Validation

**Question**: How are stage transitions currently validated?

**Investigation**: Reviewed `/lib/stage-validation.ts` and `/app/api/tickets/[id]/route.ts`

**Current Implementation**:

**Validation Function** (`lib/stage-validation.ts:64-67`):
```typescript
export function isValidTransition(fromStage: Stage, toStage: Stage): boolean {
  const nextStage = getNextStage(fromStage);
  return nextStage === toStage;
}
```

**Validation Logic** (`lib/stage-validation.ts:38-48`):
```typescript
export function getNextStage(currentStage: Stage): Stage | null {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
    return null;
  }

  const nextStage = STAGE_ORDER[currentIndex + 1];
  return nextStage ?? null;
}
```

**API Validation** (`app/api/tickets/[id]/route.ts:99-108`):
```typescript
const currentStage = currentTicket.stage as Stage;
if (!isValidTransition(currentStage, newStage)) {
  return NextResponse.json(
    {
      error: 'Invalid stage transition',
      message: `Cannot transition from ${currentStage} to ${newStage}. Tickets must progress sequentially through stages.`,
    },
    { status: 400 }
  );
}
```

**Frontend Validation** (`components/board/board.tsx:93-100`):
```typescript
if (!isValidTransition(ticket.stage, targetStage)) {
  toast({
    variant: 'destructive',
    title: 'Invalid stage transition',
    description: `Cannot move from ${ticket.stage} to ${targetStage}. Tickets must progress sequentially.`,
  });
  return;
}
```

**Decision**: No changes to validation logic required. Adding SPECIFY to STAGE_ORDER automatically enables correct validation:
- INBOX → SPECIFY (valid, next in sequence)
- SPECIFY → PLAN (valid, next in sequence)
- INBOX → PLAN (invalid, skips SPECIFY)
- SPECIFY → INBOX (invalid, backwards)

**Rationale**: Existing validation is array-index based, making it automatically extensible. The isValidTransition function only allows transitions to the immediately next stage by comparing with getNextStage result.

---

## 3. Board Column Rendering Pattern

**Question**: How are columns currently rendered on the board?

**Investigation**: Reviewed `/components/board/board.tsx` and `/components/board/stage-column.tsx`

**Current Implementation**:

**Board Component** (`components/board/board.tsx:206-228`):
```typescript
const stages = getAllStages(); // Returns STAGE_ORDER array

return (
  <div
    data-testid="board-grid"
    className="grid gap-4 overflow-x-auto pb-6 px-4 pt-4"
    style={{
      gridTemplateColumns: 'repeat(5, minmax(300px, 1fr))', // 5 columns hardcoded
      height: 'calc(100vh - 32px)',
    }}
  >
    {stages.map((stage) => (
      <StageColumn
        key={stage}
        stage={stage}
        tickets={ticketsByStage[stage] || []}
        isDraggable={isOnline}
        onTicketClick={handleTicketClick}
      />
    ))}
  </div>
);
```

**Column Configuration** (`components/board/stage-column.tsx:19-91`):
```typescript
const STAGE_CONFIG: Record<Stage, {
  label: string;
  color: string;
  bgColor: string;
  headerBgColor: string;
  headerBorderColor: string;
  textColor: string;
  borderColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  order: number;
}> = {
  [Stage.INBOX]: {
    label: 'INBOX',
    color: 'gray',
    bgColor: 'bg-zinc-950/80',
    // ... (gray theme)
    order: 0,
  },
  [Stage.PLAN]: {
    label: 'PLAN',
    color: 'blue',
    bgColor: 'bg-blue-950/40',
    // ... (blue theme)
    order: 1,
  },
  // ... (BUILD green, VERIFY orange, SHIP purple)
};
```

**Decision**: Two changes required:
1. Update `gridTemplateColumns` from `repeat(5, ...)` to `repeat(6, ...)` in `board.tsx:224`
2. Add SPECIFY configuration to STAGE_CONFIG with order: 1, shifting all subsequent orders +1

**Color Choice**: Per clarification, use existing color pattern. Recommendation: **yellow/amber** theme to maintain visual distinction between stages:
- INBOX: gray (existing)
- **SPECIFY**: yellow/amber (new - warm color between gray and blue)
- PLAN: blue (existing, order changes to 2)
- BUILD: green (existing, order changes to 3)
- VERIFY: orange (existing, order changes to 4)
- SHIP: purple (existing, order changes to 5)

**Rationale**: Color progression creates visual workflow: neutral (gray) → warming up (yellow) → active (blue/green) → finalizing (orange/purple). getAllStages() automatically includes SPECIFY once added to STAGE_ORDER, so column rendering is dynamic.

---

## 4. Stage Badge Styling Pattern

**Question**: How are stage badges currently styled?

**Investigation**: Reviewed `/components/board/ticket-card.tsx` and `/components/board/stage-column.tsx`

**Current Implementation**:

**Ticket Card Badge** (`components/board/ticket-card.tsx:66-68`):
```typescript
<Badge className="bg-blue-600 text-blue-50 border-blue-500 hover:bg-blue-700 text-xs px-2 py-0.5 font-semibold">
  SONNET
</Badge>
```
*Note: This badge shows AI model ("SONNET"), not stage. Badge styling is hardcoded blue.*

**Column Header Count Badge** (`components/board/stage-column.tsx:130-134`):
```typescript
<span
  className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.58rem] font-semibold shadow-[0_0_8px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/10 ${stageConfig.badgeBgColor} ${stageConfig.badgeTextColor}`}
>
  {ticketCount}
</span>
```
*Note: Ticket count badge uses STAGE_CONFIG colors (badgeBgColor, badgeTextColor).*

**STAGE_CONFIG Badge Colors**:
- INBOX: `bg-zinc-800/70`, `text-zinc-50`
- PLAN: `bg-blue-800/70`, `text-blue-100`
- BUILD: `bg-emerald-800/70`, `text-emerald-50`
- VERIFY: `bg-orange-800/70`, `text-orange-50`
- SHIP: `bg-purple-800/70`, `text-purple-50`

**Decision**: Stage badges are configured via STAGE_CONFIG, not in TicketCard component. The "SONNET" badge is unrelated to stage workflow. For SPECIFY, add badge colors to STAGE_CONFIG following the established pattern:
```typescript
badgeBgColor: 'bg-yellow-800/70',  // or amber-800
badgeTextColor: 'text-yellow-50',  // or amber-50
```

**Clarification Applied**: "Match existing color scheme" means follow the STAGE_CONFIG pattern with appropriate color for SPECIFY's position in workflow.

**Rationale**: Centralized STAGE_CONFIG makes color management consistent across column headers, count badges, and any future stage-based UI elements.

---

## 5. Empty State Pattern

**Question**: What empty state message do other columns show?

**Investigation**: Reviewed `/components/board/stage-column.tsx`

**Current Implementation** (`components/board/stage-column.tsx:154-158`):
```typescript
{tickets.length > 0 ? (
  tickets.map((ticket) => (
    <TicketCard ... />
  ))
) : (
  <div className="text-center text-sm text-zinc-400/90 py-12 font-medium">
    No tickets
  </div>
)}
```

**Decision**: Use identical empty state for SPECIFY column: `"No tickets"` with same styling.

**Clarification Applied**: "Same as other columns" confirmed.

**Rationale**: Consistency across all columns. Empty state is informational, not actionable (only INBOX has "New Ticket" button).

---

## 6. Error Toast Pattern

**Question**: How are error messages currently displayed?

**Investigation**: Reviewed toast usage in `/components/board/board.tsx`

**Current Implementation**:

**Invalid Transition Toast** (`components/board/board.tsx:94-99`):
```typescript
toast({
  variant: 'destructive',
  title: 'Invalid stage transition',
  description: `Cannot move from ${ticket.stage} to ${targetStage}. Tickets must progress sequentially.`,
});
```

**Version Conflict Toast** (`components/board/board.tsx:135-139`):
```typescript
toast({
  variant: 'destructive',
  title: 'Ticket modified by another user',
  description: 'Please refresh the page and try again.',
});
```

**Network Error Toast** (`components/board/board.tsx:166-170`):
```typescript
toast({
  variant: 'destructive',
  title: 'Network error',
  description: 'Could not update ticket. Please check your connection.',
});
```

**Decision**: Reuse existing error toast pattern. No changes needed for SPECIFY - isValidTransition will reject invalid SPECIFY transitions and trigger the same toast.

**Example Messages** (generated automatically by existing code):
- INBOX → PLAN: "Cannot move from INBOX to PLAN. Tickets must progress sequentially."
- SPECIFY → INBOX: "Cannot move from SPECIFY to INBOX. Tickets must progress sequentially."

**Clarification Applied**: "Use already implemented error message pattern" confirmed.

**Rationale**: useToast hook from shadcn/ui provides consistent toast notifications. Existing validation logic already generates descriptive error messages with stage names.

---

## 7. Migration Best Practices

**Question**: What's the best practice for adding enum values in Prisma?

**Investigation**: Prisma documentation and migration patterns

**Prisma Enum Migration Approach**:

**Step 1**: Update `prisma/schema.prisma`:
```prisma
enum Stage {
  INBOX
  SPECIFY  // <- Add new value
  PLAN
  BUILD
  VERIFY
  SHIP
}
```

**Step 2**: Generate migration:
```bash
npx prisma migrate dev --name add_specify_stage
```

**Step 3**: Prisma generates SQL migration:
```sql
-- AlterEnum
ALTER TYPE "Stage" ADD VALUE 'SPECIFY' BEFORE 'PLAN';
```

**Migration Safety**:
- ✅ Adding enum values is non-destructive
- ✅ Existing data (tickets with PLAN/BUILD/VERIFY/SHIP) remains valid
- ✅ Default value (INBOX) unchanged
- ✅ Foreign key constraints (stage field in Ticket model) automatically updated
- ⚠️ Enum order matters in PostgreSQL - value must be added at correct position

**Decision**: Use Prisma's built-in enum migration with `BEFORE 'PLAN'` clause to insert SPECIFY at correct workflow position.

**Testing Approach**:
1. Apply migration to test database
2. Verify existing tickets retain their stages (query all tickets)
3. Create new ticket (should default to INBOX)
4. Test transitions: INBOX → SPECIFY ✅, SPECIFY → PLAN ✅
5. Test invalid transitions blocked: INBOX → PLAN ❌, SPECIFY → INBOX ❌

**Clarification Applied**: "Existing tickets in PLAN/BUILD/VERIFY/SHIP unchanged during migration" confirmed.

**Rationale**: PostgreSQL enum migrations are atomic and safe when adding values. Prisma handles SQL generation correctly. No data migration (UPDATE statements) needed since existing tickets stay in current stages.

---

## Summary of Decisions

| Component | Change Required | Pattern to Follow |
|-----------|----------------|-------------------|
| **Prisma Schema** | Add `SPECIFY` between `INBOX` and `PLAN` | Existing enum pattern |
| **TypeScript Enum** | Add `Stage.SPECIFY = 'SPECIFY'` | Existing enum pattern |
| **Stage Order Array** | Insert at index 1: `[INBOX, SPECIFY, PLAN, ...]` | Existing array pattern |
| **Validation Logic** | No changes (automatic via array-based logic) | Existing `isValidTransition` |
| **Board Grid** | Change `repeat(5, ...)` to `repeat(6, ...)` | Existing grid pattern |
| **Stage Config** | Add SPECIFY with yellow/amber theme, order: 1 | Existing STAGE_CONFIG pattern |
| **Badge Colors** | `bg-yellow-800/70`, `text-yellow-50` | Existing badgeBgColor pattern |
| **Empty State** | "No tickets" (identical to other columns) | Existing empty state pattern |
| **Error Toasts** | No changes (automatic via existing validation) | Existing toast pattern |
| **Migration** | `ALTER TYPE "Stage" ADD VALUE 'SPECIFY' BEFORE 'PLAN'` | Prisma enum migration |

---

## Technical Risks & Mitigations

**Risk 1**: Migration fails if applied to production with active transactions
- **Mitigation**: Apply during maintenance window, test on staging first

**Risk 2**: Cached getAllStages() results may not include SPECIFY after deployment
- **Mitigation**: Clear application cache, restart Next.js server after migration

**Risk 3**: Hardcoded column count (5) breaks layout if missed
- **Mitigation**: Comprehensive search for hardcoded "5" related to stages/columns

**Risk 4**: Stage order changes break existing logic relying on numeric positions
- **Mitigation**: Review all uses of STAGE_ORDER.indexOf() and order property in STAGE_CONFIG

---

## Open Questions Resolved

All research questions answered. No remaining unknowns. Ready to proceed to Phase 1 (design artifacts).
