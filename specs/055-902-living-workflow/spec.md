# Feature Specification: Living Workflow Section

**Feature Branch**: `055-902-living-workflow`
**Created**: 2025-10-26
**Status**: Draft
**Input**: User description: "#902 Living workflow section - Transform the workflow section into an animated mini-Kanban on the landing page"

## Auto-Resolved Decisions

- **Decision**: Animation timing and behavior
- **Policy Applied**: AUTO (resolved to PRAGMATIC with documentation)
- **Confidence**: Medium (0.6) - Marketing/demo feature with no data handling or security concerns, but AUTO analysis detected mixed signals due to both neutral and internal/speed keywords
- **Fallback Triggered?**: Yes - AUTO recommended CONSERVATIVE due to 2 conflicting signal buckets (neutral feature context vs. internal/speed keywords), but manual review determined PRAGMATIC is appropriate for this pure visual feature
- **Trade-offs**:
  1. **Scope/Quality**: Using 10-second interval as specified (no performance optimization needed for landing page demo)
  2. **Timeline/Cost**: Standard CSS animations are sufficient; no complex animation library needed
- **Reviewer Notes**: This is a marketing/demo feature with no user data, authentication, or business logic. The specification uses concrete values from user input (10 seconds, 2-3 tickets, 6 columns) rather than seeking clarification on this low-risk visual component.

---

- **Decision**: Drag interaction behavior ("possibilité de drag (sans effet)")
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) - Clear intent from description: visual feedback only, no functional drag-and-drop
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope/Quality**: Cursor feedback and visual state changes only; does not implement actual reordering logic
  2. **Timeline/Cost**: Simpler implementation; reduces development time
- **Reviewer Notes**: User specified "drag (sans effet)" - this means visual drag affordance only, not functional drag-and-drop. Confirm this interpretation matches intended UX.

---

- **Decision**: Ticket content and progression pattern
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) - Demo feature with representative examples
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope/Quality**: Using 2-3 example tickets with generic titles; no need for real ticket data
  2. **Timeline/Cost**: Hardcoded examples reduce complexity
- **Reviewer Notes**: Example tickets should demonstrate typical workflow progression; content can be refined during implementation based on marketing messaging.

## User Scenarios & Testing

### User Story 1 - First-Time Visitor Understanding Workflow (Priority: P1)

A visitor lands on the homepage and immediately sees how the AI Board workflow operates through a live animated demonstration without needing to read documentation or watch a video.

**Why this priority**: This is the primary value proposition of the feature - instant visual understanding of the product's core workflow. Without this, the feature has no purpose.

**Independent Test**: Can be fully tested by loading the landing page and observing the animated mini-Kanban for 30 seconds. Delivers immediate value by visually explaining the 6-stage workflow without user interaction.

**Acceptance Scenarios**:

1. **Given** a visitor loads the landing page, **When** they scroll to the workflow section, **Then** they see a mini-Kanban board with 6 labeled columns (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
2. **Given** the mini-Kanban is visible, **When** 10 seconds elapse, **Then** one example ticket smoothly animates from one current column to the next column
3. **Given** tickets are animating, **When** the visitor observes the board, **Then** they see 2-3 example tickets at different stages in the workflow
4. **Given** the animation is running, **When** the visitor watches for 60 seconds, **Then** they see a complete journey of a ticket moving from INBOX through all stages to SHIP

---

### User Story 2 - Interactive Hover Experience (Priority: P2)

A visitor exploring the workflow section hovers over a ticket or column and the animation pauses, allowing them to examine the current state and potentially interact with drag affordance.

**Why this priority**: Enhances engagement and provides control to curious visitors who want to examine the workflow more closely. Adds polish but is not essential for understanding the workflow.

**Independent Test**: Can be tested by hovering over any ticket or column area and verifying animation pause and cursor feedback. Delivers enhanced interactivity for engaged visitors.

**Acceptance Scenarios**:

1. **Given** tickets are animating, **When** a visitor hovers their cursor over a ticket, **Then** the animation pauses and the cursor changes to indicate draggability
2. **Given** the animation is paused on hover, **When** the visitor attempts to drag a ticket, **Then** the ticket provides visual feedback (following cursor or visual highlight) but does not functionally change position
3. **Given** a visitor is hovering and animation is paused, **When** they move their cursor away, **Then** the animation resumes from where it paused

---

### User Story 3 - Visual Brand Consistency (Priority: P3)

A visitor familiar with the actual AI Board application recognizes the mini-Kanban as matching the real product's visual design, building trust and expectation accuracy.

**Why this priority**: Maintains design consistency and sets accurate expectations, but doesn't block understanding of the workflow. Can be refined post-launch.

**Independent Test**: Can be tested by comparing the mini-Kanban visual styling (colors, shadows, border-radius) against the actual board in the application. Delivers brand consistency for returning visitors.

**Acceptance Scenarios**:

1. **Given** a visitor views the mini-Kanban, **When** they compare it to screenshots or the actual product, **Then** the color scheme, card shadows, and rounded corners match the real board's design
2. **Given** a visitor is familiar with the actual board, **When** they see the landing page demo, **Then** they recognize it as representative of the real product experience

---

### Edge Cases

- What happens when a visitor has reduced motion preferences enabled in their browser/OS (prefers-reduced-motion)?
- How does the animation behave if the section is not visible (below fold) or in a background tab?
- What happens if a visitor resizes their browser window during animation?
- How does the mini-Kanban display on mobile devices with limited width?

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a mini-Kanban board with exactly 6 vertical columns labeled "INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", and "SHIP" in that order
- **FR-002**: System MUST show 2-3 example tickets positioned across different columns at any given time
- **FR-003**: System MUST animate one ticket moving from its current column to the next column every 10 seconds
- **FR-004**: Animation MUST be smooth and subtle (no jarring jumps or rapid movements)
- **FR-005**: System MUST pause all animations when a visitor hovers over any ticket or the board area
- **FR-006**: System MUST resume animations when the visitor's cursor leaves the board area
- **FR-007**: System MUST provide visual drag affordance (cursor change) when hovering over tickets
- **FR-008**: System MUST allow simulated drag interaction (ticket follows cursor or shows visual highlight) without functional position changes
- **FR-009**: System MUST match the visual styling of the actual AI Board (colors, shadows, border-radius for cards and columns)
- **FR-010**: System MUST respect user accessibility preferences for reduced motion (disable/simplify animations if prefers-reduced-motion is set)
- **FR-011**: System MUST display a complete ticket journey from INBOX to SHIP within a reasonable viewing period (60 seconds maximum)
- **FR-012**: System MUST handle viewport resizing gracefully without breaking the animation or layout

### Key Entities

- **Demo Ticket**: Represents an example work item in the animated demo
  - Attributes: Title, current column position, visual state (normal/hover/dragging)
  - Behavior: Animates between columns, responds to hover, provides drag feedback

- **Mini-Kanban Column**: Represents one of the 6 workflow stages
  - Attributes: Stage name (INBOX, SPECIFY, etc.), visual styling, position in sequence
  - Behavior: Contains tickets, triggers ticket transitions

## Success Criteria

### Measurable Outcomes

- **SC-001**: Visitors can understand the 6-stage workflow within 30 seconds of viewing the animated mini-Kanban without reading supplementary text
- **SC-002**: Animation runs smoothly at 60fps on devices with standard hardware (2018+ laptops/smartphones)
- **SC-003**: 100% of hover interactions pause/resume animation within 100ms (perceived as instant)
- **SC-004**: Mini-Kanban renders correctly on viewports from 320px (mobile) to 2560px (large desktop) width
- **SC-005**: Users with prefers-reduced-motion enabled see a static or minimally-animated version that still communicates the workflow
- **SC-006**: Visual design inspection confirms 95%+ match with actual AI Board styling (color values, shadow properties, border-radius values)
- **SC-007**: Complete ticket journey (INBOX → SHIP) completes within 60 seconds of continuous viewing
