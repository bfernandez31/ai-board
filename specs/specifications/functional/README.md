# AI Board - Functional Documentation

This directory contains user-facing functional documentation describing **what** the AI Board application does, not **how** it's implemented.

## Purpose

These documents are written for:
- Product managers understanding feature scope
- Business stakeholders evaluating capabilities
- New team members learning the system
- QA teams understanding expected behaviors

## Documentation Structure

### [01-kanban-board.md](01-kanban-board.md)
**Kanban Board Behavior**

Describes the visual workflow system with six stages (INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP), sequential stage progression rules, and drag-and-drop ticket movement.

**Key Topics**:
- Six workflow stages and their purposes
- Sequential vs. quick implementation paths
- Column layout and visual organization
- Ticket card display and information
- Responsive behavior across devices

---

### [02-ticket-management.md](02-ticket-management.md)
**Ticket Lifecycle and Management**

Covers the complete lifecycle of tickets from creation through stage transitions, including validation rules, viewing details, and data persistence.

**Key Topics**:
- Creating tickets with title and description
- Form validation and character limits
- Drag-and-drop stage transitions
- Visual feedback during drag operations
- Ticket detail modal and attributes
- Concurrent update handling

---

### [03-collaboration.md](03-collaboration.md)
**Comments, Mentions, and Conversations**

Explains the comment system for team discussions, @mentions for user notifications, and AI-BOARD assistance for collaborative specification refinement.

**Key Topics**:
- Posting and viewing comments
- Markdown support for rich formatting
- Deleting own comments
- @mentions and user notifications
- AI-BOARD integration and availability
- Real-time comment updates
- Tab navigation in ticket modal

---

### [04-automation.md](04-automation.md)
**Automated Workflows and Policies**

Describes AI-powered workflows that automatically generate specifications, plans, and implementations when tickets move through stages.

**Key Topics**:
- Workflow job creation and tracking
- Job status lifecycle (PENDING → RUNNING → COMPLETED/FAILED)
- Automatic specification generation
- Clarification policies (AUTO, CONSERVATIVE, PRAGMATIC)
- Planning and implementation generation
- Quick implementation workflow
- Git branch management
- Error handling and recovery

---

### [05-projects.md](05-projects.md)
**Multi-Project Management**

Covers project organization, settings, and access control. Each project maintains separate tickets, settings, and automation policies.

**Key Topics**:
- Project structure and attributes
- Project list view and navigation
- Clarification policy configuration
- User-project ownership model
- AI-BOARD automatic membership
- Project-level vs. ticket-level settings
- Multi-project workflows

---

### [06-user-interface.md](06-user-interface.md)
**UI Behaviors and Interactions**

Details visual design, interactive elements, responsive behavior, and accessibility features across all interface components.

**Key Topics**:
- Dark theme and color system
- Drag-and-drop visual feedback
- Modal behaviors and keyboard shortcuts
- Responsive layouts (desktop, tablet, mobile)
- Loading states and error presentation
- Accessibility features
- Performance expectations

---

## What's NOT in These Documents

These functional specifications intentionally **exclude**:

- ❌ Technical implementation details (APIs, database schemas)
- ❌ Code structure and architecture
- ❌ Technology stack choices (frameworks, libraries)
- ❌ Deployment and infrastructure
- ❌ Development workflows and testing strategies

For technical implementation details, see:
- `CLAUDE.md` - Development guidelines and technical patterns
- `specs/` - Individual feature specifications with implementation details
- API documentation (when available)

## Reading Guide

### For Product Managers
Start with **01-kanban-board.md** to understand the core workflow, then review **02-ticket-management.md** and **04-automation.md** to see how tickets flow through the system.

### For Business Stakeholders
Read **01-kanban-board.md** for the overall concept, then **04-automation.md** to understand the AI-powered automation value proposition.

### For QA/Testers
Review all documents sequentially. Pay special attention to:
- Business rules and validation constraints
- Edge cases and error conditions
- Expected behaviors for user interactions

### For New Developers
Start with these functional docs to understand user-facing behaviors, then transition to `CLAUDE.md` and `specs/` for implementation details.

## Maintenance

These documents describe the **current state** of the application. They should be updated when:
- New features are added
- Existing behaviors change
- Business rules are modified

Historical information and deprecated features are **not** included - only current functionality is documented.

## Questions or Clarifications

If these documents don't answer your questions about application behavior, check:
1. Individual feature specifications in `specs/`
2. `CLAUDE.md` for implementation-specific details
3. Source code comments for edge case handling

---

**Last Updated**: 2025-10-28
