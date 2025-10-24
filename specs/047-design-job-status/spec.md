# Feature Specification: Simplified Job Status Display

**Feature Branch**: `047-design-job-status`
**Created**: 2025-10-24
**Status**: Implemented
**Input**: User description: "Design job status - je souhaite simplifier les jobs status qu'on a sur les ticket le dual est bcp trop intrusif."

## Auto-Resolved Decisions

- **Decision**: None - This is a purely visual refinement with explicit design requirements provided.

## User Scenarios & Testing

### User Story 1 - Simplified Workflow Job Status (Priority: P1)

Users view ticket cards with a cleaner, less intrusive workflow job status display that shows only the essential status information without redundant labels.

**Why this priority**: This is the primary use case - every user interacts with ticket cards, and reducing visual noise improves readability and scanning efficiency across the board.

**Independent Test**: Can be fully tested by viewing any ticket with an active workflow job (SPECIFY, PLAN, BUILD). Success means users see only the status icon and label (e.g., "✅ COMPLETED") without the stage prefix (e.g., no more "🔧 BUILD :").

**Acceptance Scenarios**:

1. **Given** a ticket is in BUILD stage with a COMPLETED workflow job, **When** viewing the ticket card, **Then** the status displays only "✅ COMPLETED" without "🔧 BUILD :" prefix
2. **Given** a ticket has a RUNNING workflow job, **When** viewing the ticket card, **Then** the status displays only the animated status icon with contextual label (e.g., "✏️ WRITING") without stage prefix
3. **Given** a ticket has a PENDING workflow job, **When** viewing the ticket card, **Then** the status displays only "⏱️ PENDING" without stage prefix

---

### User Story 2 - Compact AI-BOARD Status Indicator (Priority: P1)

Users see AI-BOARD job status as a compact icon on the same line as the workflow job status, positioned to the right, making it clear that AI-BOARD assistance is a complementary action rather than a primary workflow step.

**Why this priority**: Essential for distinguishing between automated workflow jobs and AI assistance, while maintaining a clean single-line layout that reduces vertical space usage.

**Independent Test**: Can be fully tested by mentioning @ai-board in a ticket comment and observing the job status display. Success means the AI-BOARD status appears as a bot icon on the right side of the same line as the workflow status, with appropriate color coding.

**Acceptance Scenarios**:

1. **Given** a ticket has both a workflow job and an AI-BOARD job in RUNNING state, **When** viewing the ticket card, **Then** both statuses appear on the same line with AI-BOARD indicator on the right
2. **Given** an AI-BOARD job is RUNNING, **When** viewing the ticket card, **Then** the bot-message-square icon displays in purple (#a855f7) with bounce animation and tooltip indicating assistance is in progress
3. **Given** an AI-BOARD job is PENDING, **When** viewing the ticket card, **Then** the bot-message-square icon displays in purple (#a855f7) with bounce animation and tooltip "AI-BOARD is preparing..."
4. **Given** an AI-BOARD job has COMPLETED, **When** viewing the ticket card, **Then** the bot-message-square icon displays in purple (#a855f7) without animation and tooltip showing completion timestamp
5. **Given** an AI-BOARD job has FAILED, **When** viewing the ticket card, **Then** the bot-message-square icon displays in red (#ef4444) without animation and tooltip showing "AI-BOARD assistance failed"

---

### User Story 3 - AI-BOARD Status Differentiation (Priority: P2)

Users visually distinguish between workflow job statuses and AI-BOARD assistance through consistent color coding and positioning.

**Why this priority**: While important for usability, users can still understand the system with just the basic display changes from P1 stories. This story ensures polish and clarity.

**Independent Test**: Can be tested by creating tickets with various combinations of workflow and AI-BOARD jobs and verifying visual consistency across all status states.

**Acceptance Scenarios**:

1. **Given** multiple tickets with AI-BOARD jobs in different states, **When** scanning the board, **Then** purple icons consistently indicate AI-BOARD involvement, while standard status colors (green, red, gray) indicate outcomes
2. **Given** an AI-BOARD job transitions from RUNNING to COMPLETED, **When** observing the transition, **Then** the purple icon remains visible in the same position
3. **Given** hovering over a completed AI-BOARD indicator, **When** the tooltip appears, **Then** it shows the formatted timestamp of when AI-BOARD assistance completed

---

### Edge Cases

- What happens when a ticket has only an AI-BOARD job without a workflow job? The AI-BOARD indicator should still appear on its own line (or position where workflow status would be) with the same right-aligned visual treatment.
- What happens when workflow status text is very long (e.g., "WRITING" in SPECIFY stage)? The layout should maintain the single-line format with AI-BOARD indicator consistently positioned at the right, allowing the main status to take available space without wrapping.
- What happens when AI-BOARD job completes while workflow job is still running? Both indicators coexist on the same line, each showing their respective states independently.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display workflow job status without stage name prefix (remove "🔧 BUILD :", "📝 SPECIFY :", etc.)
- **FR-002**: System MUST display only the status icon and label for workflow jobs (e.g., "✅ COMPLETED", "✏️ WRITING")
- **FR-003**: System MUST display AI-BOARD job status as a bot-message-square icon only (no text label)
- **FR-004**: System MUST position AI-BOARD indicator on the same line as workflow status, aligned to the right
- **FR-005**: System MUST apply purple color (#a855f7) to AI-BOARD icon for PENDING, RUNNING, and COMPLETED states
- **FR-006**: System MUST apply red color (#ef4444) to AI-BOARD icon for FAILED state
- **FR-007**: System MUST apply gray color (#6b7280) to AI-BOARD icon for CANCELLED state
- **FR-008**: System MUST provide tooltips for AI-BOARD indicators with status-specific messages
- **FR-009**: System MUST format AI-BOARD completion timestamp in tooltips in human-readable format
- **FR-010**: System MUST apply bounce animation to AI-BOARD icon for PENDING and RUNNING states
- **FR-011**: System MUST display AI-BOARD icon at 20px size (h-5 w-5) for better visibility

### Key Entities

- **Job Status Display**: Visual representation combining icon, color, label, and optional animation based on job state
- **AI-BOARD Indicator**: Specialized compact indicator distinguishing AI assistance from workflow automation
- **Tooltip Content**: Contextual information providing status details and timestamps for AI-BOARD actions

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can identify job status at a glance without reading redundant stage labels
- **SC-002**: Ticket cards consume 20-30% less vertical space for job status display (single line vs. dual lines)
- **SC-003**: Users can distinguish between workflow automation and AI-BOARD assistance through visual cues alone (color, position, icon)
- **SC-004**: Board scanning time improves as users spend less time parsing job status information
- **SC-005**: Zero confusion reports about which jobs are workflow-driven vs. AI-BOARD assistance based on visual design
