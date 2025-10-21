# Foundation

## Overview

This domain covers the core kanban board functionality and basic ticket display. These are the fundamental features that make up the visual workflow management system.

**Current Capabilities**:
- 6-column kanban board with color-coded stages
- Ticket cards with status indicators
- Ticket creation and display
- Responsive layout for mobile and desktop

---

## Kanban Board

**Purpose**: Users need a visual representation of work items organized by workflow stage. The kanban board provides at-a-glance visibility into ticket status and workflow progression.

### What It Does

The system displays a visual kanban board with six workflow stages:

**Board Layout**:
- **6 Columns**: INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP
- **Color-Coded**: Each stage has distinct color (INBOX: gray, SPECIFY: yellow, PLAN: blue, BUILD: green, VERIFY: orange, SHIP: purple)
- **Column Headers**: Display stage name and current ticket count
- **Scrollable Columns**: Each column scrolls independently when containing many tickets
- **Responsive Design**:
  - Desktop: Columns displayed side-by-side
  - Mobile (<375px): Horizontal scroll to view all columns

**Ticket Cards**:
- **Ticket ID**: Unique sequential identifier (#1, #2, etc.)
- **Title**: Ticket title (max 2 lines with ellipsis truncation)
- **Status Badge**: Current stage indicator
- **Timestamp**:
  - Recent (<24h): Relative format ("2 hours ago")
  - Older: Absolute format ("2025-09-30 14:30")
- **Hover Feedback**: Visual indication when hovering over cards

**Dark Theme**:
- Application uses dark theme by default
- Consistent zinc color palette throughout

### Requirements

**Display**:
- 6 columns displayed side-by-side: INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP
- Column headers show stage name and ticket count
- Color-coded stages for visual distinction
- Scrollable area within each column for ticket cards
- Dark theme styling

**Ticket Cards**:
- Display ticket ID, title, status badge, timestamp
- Title truncated to 2 lines with ellipsis if longer
- Timestamp format: relative for <24h, absolute for older
- Visual hover feedback

**Responsive**:
- Desktop: All columns visible side-by-side
- Mobile (<375px): Horizontal scroll enabled
- All 6 columns remain accessible on all devices

**Data Persistence**:
- Ticket data persists across page refreshes
- Database-backed storage

### Data Model

**Ticket Display Fields**:
- `id`: Unique sequential integer
- `title`: Text (displayed with 2-line truncation)
- `description`: Longer text (not shown on card)
- `stage`: Current workflow stage (INBOX | SPECIFY | PLAN | BUILD | VERIFY | SHIP)
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp (displayed on card)

**Stage Values**:
- `INBOX`: Initial stage for new tickets
- `SPECIFY`: Specification generation stage
- `PLAN`: Planning stage
- `BUILD`: Implementation stage
- `VERIFY`: Review/testing stage
- `SHIP`: Completed stage

---

## Ticket Creation

**Purpose**: Users need to create new work items to track tasks, features, or issues. The creation form provides a guided input experience with validation.

### What It Does

The system provides a modal form for creating tickets:

**Creation Flow**:
1. User clicks "+ New Ticket" button in INBOX column
2. Modal dialog opens with creation form
3. User enters title and description
4. User clicks Create (or Cancel to abort)
5. New ticket appears in INBOX column

**Form Fields**:
- **Title**: Required, max 100 characters
- **Description**: Required, max 1000 characters
- **Character Restrictions**: Alphanumeric and basic punctuation only (no emojis, no special characters)

**Validation**:
- Real-time validation as user types
- Create button disabled when fields invalid
- Clear error messages for validation failures
- Cannot submit empty or whitespace-only fields

**User Feedback**:
- Loading state during creation
- Immediate display of created ticket
- Error messages with retry option for failures
- 15-second timeout with error message

**Modal Controls**:
- Cancel button closes modal without creating ticket
- Click outside modal closes without creating
- ESC key closes modal

### Requirements

**Button & Modal**:
- "+ New Ticket" button at top of INBOX column
- Modal dialog opens on button click
- Title input field (required)
- Description textarea field (required)
- Cancel and Create buttons

**Validation**:
- Title: required, max 100 characters, no whitespace-only
- Description: required, max 1000 characters, no whitespace-only
- Character restrictions: alphanumeric + basic punctuation (. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ ` |)
- Real-time error display as user types
- Create button disabled when invalid

**Ticket Creation**:
- Creates ticket with title and description
- Places ticket in INBOX stage automatically
- Displays immediately in INBOX column
- Shows loading state during creation
- 15-second timeout with error message
- Records creation and update timestamps

**Modal Dismissal**:
- Cancel button closes without creating
- Click outside closes without creating
- ESC key closes without creating

### Data Model

**Created Ticket**:
- `title`: 1-100 characters, alphanumeric + basic punctuation
- `description`: 1-1000 characters, alphanumeric + basic punctuation
- `stage`: Set to INBOX automatically
- `projectId`: Assigned from current project context
- `createdAt`: Timestamp of creation
- `updatedAt`: Initially same as createdAt

---

## Current State Summary

### Available Features

**Visual Board**:
- ✅ 6-column kanban layout with color coding
- ✅ Ticket cards with ID, title, badge, timestamp
- ✅ Responsive design (desktop and mobile)
- ✅ Dark theme throughout
- ✅ Column headers with ticket counts
- ✅ Independent column scrolling

**Ticket Creation**:
- ✅ Modal-based creation form
- ✅ Real-time validation
- ✅ Character limits (title 100, description 1000)
- ✅ Character restrictions (no emojis/special chars)
- ✅ Immediate ticket display after creation
- ✅ Multiple modal dismissal methods

**Data Management**:
- ✅ Database persistence
- ✅ Sequential ticket IDs
- ✅ Automatic timestamp tracking
- ✅ Project scoping (tickets belong to projects)

### User Workflows

**Viewing the Board**:
1. User navigates to `/projects/{projectId}/board`
2. System displays 6-column kanban board
3. User sees all tickets organized by stage
4. User can scroll within columns to view all tickets
5. On mobile: user scrolls horizontally to view all columns

**Creating a Ticket**:
1. User clicks "+ New Ticket" in INBOX column
2. Modal opens with empty form
3. User enters title (1-100 chars)
4. User enters description (1-1000 chars)
5. User clicks Create
6. Ticket appears immediately in INBOX column

### Business Rules

- New tickets always created in INBOX stage
- Ticket IDs are sequential integers
- Timestamps displayed relatively for recent, absolutely for older
- All tickets must belong to a project
- Character validation prevents special characters and emojis
- 15-second timeout for creation requests

### Technical Details

**Application Stack**:
- Next.js 15 with App Router
- TypeScript 5.x strict mode
- React 18
- TailwindCSS 3.x for styling
- Dark theme (zinc palette)
- Cloudinary CDN for image storage and delivery

**Development**:
- Hot module reloading
- ESLint and TypeScript for code quality
- Build process for production deployment

**External Services**:
- Cloudinary (image CDN)
  - Free tier: 25GB storage, 25GB bandwidth/month
  - Public HTTPS URLs for fast global delivery
  - Integration: Node.js SDK v2
  - Environment: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
