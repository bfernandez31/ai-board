# Ticket Management

## Overview

This domain covers ticket interaction features including movement between stages, viewing details, and editing content. These capabilities enable users to manage tickets throughout their workflow lifecycle.

**Current Capabilities**:
- Drag-and-drop movement between stages
- Ticket detail modal viewer
- Inline title and description editing
- Sequential workflow enforcement

---

## Drag-and-Drop Movement

**Purpose**: Users need to move tickets through workflow stages quickly. Drag-and-drop provides an intuitive, visual way to update ticket status without opening forms or dialogs.

### What It Does

The system enables dragging tickets between columns with visual feedback:

**Drag Operations**:
- **Pick Up**: Click and hold any ticket card
- **Visual Feedback**:
  - Ghost/preview of dragged ticket
  - Valid drop zones highlighted
  - Invalid zones indicated
- **Drop**: Release ticket in target column
- **Cancel**: Press ESC or release outside valid zones

**Movement Rules**:
- **Sequential Only**: Tickets can only move to next immediate stage
  - INBOX → SPECIFY
  - SPECIFY → PLAN
  - PLAN → BUILD
  - BUILD → VERIFY
  - VERIFY → SHIP
- **No Skipping**: Cannot skip stages (e.g., INBOX → PLAN blocked)
- **No Backwards**: Cannot move to earlier stages (e.g., BUILD → PLAN blocked)
- **Job Completion Required**: Automated stages (SPECIFY, PLAN, BUILD) require workflow completion before next transition
  - SPECIFY → PLAN: Blocked until specify job status is COMPLETED
  - PLAN → BUILD: Blocked until plan job status is COMPLETED
  - BUILD → VERIFY: Blocked until implement job status is COMPLETED
  - Manual stages (VERIFY, SHIP) and initial transition (INBOX → SPECIFY) have no job completion requirements

**Visual Indicators**:
- Smooth animations for drag, drop, and return
- Next valid stage highlighted during drag
- Invalid transitions show rejection animation
- Touch device support (mobile/tablet)

**Performance**:
- Optimistic UI updates (instant visual feedback)
- Database update in background
- Rollback if database update fails
- <100ms latency target

### Requirements

**Drag Interaction**:
- Click and drag any ticket card
- Ghost/preview during drag
- Valid drop zones highlighted (only next sequential stage)
- Smooth animations for all movements
- Touch device support

**Stage Transitions**:
- Sequential progression only (one stage at a time)
- No skipping stages
- No backwards movement
- Visual rejection for invalid transitions
- Job completion validation for automated stages (SPECIFY, PLAN, BUILD)
- Transitions blocked when job status is PENDING, RUNNING, FAILED, or CANCELLED
- Transitions allowed when job status is COMPLETED
- Clear error messages when blocked due to incomplete job

**Data Updates**:
- Optimistic UI update (immediate visual change)
- Database update after drop
- Rollback to original position if update fails
- Error message displayed on failure

**Concurrency**:
- First-write-wins for simultaneous updates
- Second user sees error and ticket reverts
- Version-based conflict detection

**Performance**:
- <100ms latency from drop to visual update
- Maintains performance with 100+ tickets per column

**Authentication**:
- Any authenticated user can move any ticket
- Unauthenticated users cannot drag tickets

**Offline**:
- Drag-and-drop disabled when network unavailable
- Visual indicator when disabled

### Data Model

**Stage Sequence**:
```
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
```

**Ticket Update**:
- `stage`: Updated to target stage
- `version`: Incremented for concurrency control
- `updatedAt`: Set to current timestamp

---

## Ticket Detail Viewer

**Purpose**: Users need to see complete ticket information including full title, description, dates, and stage. The detail modal provides a focused view without navigating away from the board.

### What It Does

The system displays full ticket details in a modal dialog:

**Opening Detail View**:
- Click any ticket card
- Modal opens with full details

**Information Displayed**:
- **Title**: Full title (not truncated)
- **Description**: Complete description text
- **Stage**: Current stage as visual indicator
- **Created**: Creation date
- **Updated**: Last modification date
- **Typography**: Clear hierarchy and readability
- **Dark Theme**: Consistent with application styling

**Modal Controls**:
- **Close Button**: X button in corner
- **ESC Key**: Closes modal
- **Click Outside**: Closes modal
- **Responsive**:
  - Mobile: Full-screen modal
  - Desktop/Tablet: Centered with appropriate sizing

### Requirements

**Modal Display**:
- Opens when clicking any ticket card
- Displays title prominently
- Shows full description text
- Shows current stage indicator
- Shows creation and update dates
- Clear typography and visual hierarchy
- Dark theme styling

**Modal Dismissal**:
- Close button
- ESC key
- Click outside modal content

**Responsive**:
- Full-screen on mobile devices
- Centered with responsive sizing on desktop/tablet

### Data Model

**Displayed Fields**:
- `title`: Full text without truncation
- `description`: Complete description
- `stage`: Current workflow stage
- `workflowType`: Workflow path indicator (enum: FULL/QUICK, defaults to FULL)
- `clarificationPolicy`: Optional policy override (enum: AUTO/CONSERVATIVE/PRAGMATIC/INTERACTIVE, NULLABLE)
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

---

## Inline Editing

**Purpose**: Users need to update ticket information quickly without navigating to separate edit screens. Inline editing provides contextual editing directly in the detail modal.

### What It Does

The system enables editing title and description directly in the detail modal:

**Edit Activation**:
- **Title**: Click on title to edit
- **Description**: Click on description to edit
- **Visual Indicator**: Pencil icon appears on hover

**Title Editing**:
- Click title → becomes input field with focus
- Type changes
- Save: Press Enter or click outside
- Cancel: Press ESC (restores original)
- Max 100 characters enforced

**Description Editing**:
- Click description → becomes textarea with focus
- Type changes
- Character counter displayed
- 90% warning at 900 characters
- Save: Click save button
- Cancel: Click cancel button or press ESC
- Min 1, max 1000 characters enforced

**Validation**:
- Real-time validation as user types
- Save button disabled when invalid
- Cannot save empty or whitespace-only content
- Clear inline error messages

**Save Process**:
- Optimistic UI update (immediate display)
- Loading state shown
- Database update in background
- Rollback if save fails
- Success toast notification
- Board state refreshes to reflect changes

**Concurrent Editing**:
- Version-based conflict detection
- Descriptive error if conflict detected
- Prompt to refresh ticket data
- Lost update protection

### Requirements

**Edit Activation**:
- Click title or description to edit
- Pencil icon on hover indicates editability
- Auto-focus input field when entering edit mode

**Title Editing**:
- Enter edit mode on click
- Max 100 characters
- No empty or whitespace-only
- Save on Enter or click outside
- Cancel on ESC

**Description Editing**:
- Enter edit mode on click
- Character counter displayed
- Min 1, max 1000 characters
- 90% warning at 900 characters
- No empty or whitespace-only
- Save and cancel buttons visible during edit

**Validation**:
- Real-time validation
- Save disabled when invalid
- Inline error messages

**Save & Concurrency**:
- Optimistic UI update
- Loading state during save
- Rollback on failure
- Version-based conflict detection
- Success/error notifications
- Board refresh after save

### Data Model

**Editable Fields**:
- `title`: 1-100 characters
- `description`: 1-1000 characters
- `clarificationPolicy`: Optional policy override (nullable, see [08-clarification-policies.md](08-clarification-policies.md))
- `version`: Incremented on each update (concurrency control)
- `updatedAt`: Set to current timestamp on save

**Read-Only Fields**:
- `workflowType`: Set automatically during initial BUILD transition, immutable thereafter

**Validation Rules**:
- Allowed characters: letters (a-z, A-Z), numbers (0-9), spaces, and special characters (`. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`)
- Rejects characters outside allowed set (emojis, control characters, other Unicode)
- No empty or whitespace-only values
- Character limits enforced
- Same validation rules apply to both title and description fields

---

## Workflow Type Tracking

**Purpose**: Users need to quickly identify which tickets were implemented through the quick-implementation path versus the full specification workflow. The workflow type badge provides a persistent visual indicator that distinguishes between these two implementation approaches.

### What It Does

The system tracks and displays the workflow path used for each ticket:

**Workflow Types**:
- **FULL** (default): Standard workflow path (INBOX → SPECIFY → PLAN → BUILD)
  - Creates complete specification, planning documents, and task breakdown
  - Appropriate for complex features, architectural changes, and unclear requirements
  - No badge displayed on ticket card
- **QUICK**: Quick-implementation path (INBOX → BUILD)
  - Bypasses formal specification and planning
  - Appropriate for simple fixes, typos, obvious bugs, and minor UI tweaks
  - Displays ⚡ Quick badge on ticket card

**Badge Display**:
- **Visual Indicator**: Lightning bolt emoji (⚡) with "Quick" text
- **Positioning**: Appears in ticket card header, positioned LEFT of the model badge (SONNET)
- **Styling**: Amber color scheme for visual distinction
  - Light theme: `bg-amber-100` background, `text-amber-800` text
  - Dark theme: `bg-amber-900` background, `text-amber-200` text
- **Persistence**: Badge remains visible throughout ticket lifecycle (BUILD → VERIFY → SHIP)

**Automatic Detection**:
- System automatically sets `workflowType=QUICK` when ticket transitions INBOX → BUILD
- System maintains `workflowType=FULL` (default) for all other transitions
- Field is immutable after initial setting (cannot be changed through UI)

**Data Integrity**:
- Atomic transaction: `workflowType` updated in same transaction as Job creation
- Rollback safety: If workflow dispatch fails, `workflowType` is NOT updated
- Version control: Included in optimistic concurrency control

### Requirements

**Field Definition**:
- Database field: `workflowType` enum (FULL, QUICK)
- Default value: FULL (backward compatible with existing tickets)
- Nullability: NOT NULL (always has a value)
- Index: Composite index on (projectId, workflowType) for future filtering features

**Automatic Setting**:
- Quick-impl detection: `currentStage === INBOX && targetStage === BUILD`
- Set to QUICK: During INBOX → BUILD transition, atomic with Job creation
- Set to FULL: All other transitions (default value preserved)
- Immutability: Value never changed after initial BUILD transition

**Badge Rendering**:
- Conditional display: Show badge only when `workflowType === 'QUICK'`
- Component: shadcn/ui Badge with variant="outline"
- Position: Card header, left of model badge (SONNET)
- Accessibility: Proper ARIA labels for screen readers
- Performance: <100ms render time, no layout shift

**Data Model Integration**:
- TypeScript type: `TicketWithVersion` includes `workflowType: WorkflowType`
- Board query: Selects `workflowType` field from database
- API response: Includes `workflowType` in transition endpoint response
- State management: Merged from server response into client state after transitions

**Validation**:
- Migration: All existing tickets default to FULL
- New tickets: Default to FULL via database default
- Quick-impl tickets: Automatically set to QUICK during transition
- Manual updates: Not supported through UI (database-only for corrections)

### Data Model

**WorkflowType Enum**:
- `FULL`: Standard workflow (INBOX → SPECIFY → PLAN → BUILD)
- `QUICK`: Quick-implementation (INBOX → BUILD)

**Ticket Field**:
- `workflowType`: WorkflowType enum, NOT NULL, defaults to FULL
- Set during first BUILD transition
- Immutable after setting (application-level enforcement)
- Indexed with projectId for future filtering

**Badge Styling**:
- Light theme: `bg-amber-100 text-amber-800`
- Dark theme: `bg-amber-900 dark:text-amber-200`
- Size: `text-xs px-1.5 py-0.5 font-semibold`
- Layout: `flex items-center gap-2` with model badge

**State Management**:
- Optimistic update: Badge appears immediately after drag-and-drop
- Server sync: `workflowType` merged from API response into local state
- Rollback: Reverts to FULL if transition fails

---

## Image Attachments

**Purpose**: Users need to attach visual context (screenshots, diagrams, UI mockups) to tickets for clearer specification and implementation. Image attachments enable visual documentation that complements text descriptions, particularly useful for UI bugs, design references, and architectural diagrams.

### What It Does

The system enables uploading, viewing, replacing, and deleting image attachments on tickets:

**Image Gallery**:
- **Badge Indicator**: Image count badge displays on ticket cards when attachments exist
- **Gallery Access**: Click image badge to open full image gallery modal
- **Lightbox Viewer**: Click any image to view full-size with navigation controls
- **Maximum Capacity**: Up to 5 images per ticket

**Upload Operations**:
- **File Selection**: Click upload button or drag-and-drop images
- **Supported Formats**: JPEG, PNG, GIF, WebP
- **Size Limit**: 10MB maximum per image
- **Storage**: Cloudinary CDN for fast, public access
- **Progress Feedback**: Upload progress indicator with loading states

**Management Operations**:
- **Replace Image**: Click replace icon → select new image → overwrites at same position
- **Delete Image**: Click delete icon → confirmation → removes from attachments
- **Reorder**: Images maintain upload order, indexed 0-4

**Access Control**:
- **Editable Stages**: INBOX stage only (attach mockups/screenshots before specification)
- **Read-Only Stages**: SPECIFY, PLAN, BUILD, VERIFY, SHIP (view-only)
- **Permission Guards**: UI controls disabled and API endpoints enforce stage restrictions

**Cloudinary Integration**:
- **Public URLs**: Images accessible via HTTPS URLs without authentication
- **CDN Performance**: Global CDN for fast image loading
- **Folder Structure**: `ai-board/tickets/{ticketId}/` organization
- **Deletion Management**: Cloudinary publicId stored for cleanup operations
- **Free Tier**: 25GB storage, 25GB bandwidth/month included

**Claude Workflow Integration**:
- **Specification Generation**: Images included in Claude prompts during spec/plan workflows
- **Public Access**: Claude can access images via Cloudinary URLs in GitHub Actions
- **No Repository Storage**: Images stored externally, keeping repository lightweight
- **Prompt Context**: Visual context enhances AI-generated specifications and plans

### Requirements

**Upload**:
- Max 5 images per ticket
- Supported formats: JPEG, PNG, GIF, WebP
- Max 10MB per file
- Cloudinary CDN storage with public URLs
- Upload progress indicator
- Success/error notifications
- Automatic attachment count update

**Gallery Display**:
- Image count badge on ticket cards
- Grid layout with thumbnails
- Click to open lightbox viewer
- Navigation controls (prev/next)
- Responsive sizing (mobile/desktop)
- Loading states for async operations

**Replace**:
- Replace icon on each image thumbnail
- File selection dialog
- Same validation as upload (format, size)
- Overwrites at same array position
- Deletes old image from Cloudinary
- Uploads new image to Cloudinary
- Preserves gallery position

**Delete**:
- Delete icon on each image thumbnail
- Confirmation dialog (prevent accidental deletion)
- Removes from attachments array
- Deletes image from Cloudinary
- Updates attachment count immediately

**Permission Control**:
- **SPECIFY Stage**: Full CRUD operations (upload, replace, delete)
- **PLAN Stage**: Full CRUD operations (upload, replace, delete)
- **Other Stages**: Read-only access (view only)
- UI controls disabled in read-only modes
- API returns 403 Forbidden for unauthorized operations

**Concurrent Editing**:
- Version-based conflict detection (same as title/description)
- Optimistic updates with rollback on conflict
- Error message prompts refresh on version mismatch
- Lost update protection

**Cloudinary Operations**:
- Upload: Buffer → Cloudinary → Public URL
- Delete: Cloudinary publicId → destroy operation
- Replace: Upload new → delete old (fail-safe order)
- Configuration validation: Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- Error handling: Continue database operations even if Cloudinary delete fails (prevents orphaned records)

### Data Model

**TicketAttachment Interface**:
```typescript
{
  type: 'uploaded' | 'external',
  url: string,                    // Cloudinary HTTPS URL (uploaded) or external URL
  filename: string,               // Original filename or alt text
  mimeType: string,               // e.g., "image/png"
  sizeBytes: number,              // File size in bytes
  uploadedAt: string,             // ISO 8601 timestamp
  cloudinaryPublicId?: string     // Cloudinary ID for deletion (uploaded only)
}
```

**Ticket Field**:
- `attachments`: JSON array of TicketAttachment objects (nullable, defaults to empty array)
- Stored in PostgreSQL JSONB column for querying capabilities
- Maximum 5 attachments enforced at API level

**Cloudinary Folder Structure**:
- Pattern: `ai-board/tickets/{ticketId}/{filename}`
- Example: `ai-board/tickets/915/screenshot-bug.png`
- Unique filenames: Cloudinary auto-generates unique names on conflict
- Organization: All ticket images grouped by ticket ID

**API Endpoints**:
- `GET /api/projects/{projectId}/tickets/{id}/images`: Fetch attachments metadata
- `POST /api/projects/{projectId}/tickets/{id}/images`: Upload new image
- `PUT /api/projects/{projectId}/tickets/{id}/images/{index}`: Replace image at index
- `DELETE /api/projects/{projectId}/tickets/{id}/images/{index}`: Delete image at index

**Validation Rules**:
- Max 5 attachments per ticket
- Supported MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Max file size: 10MB (10485760 bytes)
- Stage restrictions: INBOX only for CRUD operations (upload, replace, delete)
- Version control: Required for all mutating operations (POST, PUT, DELETE)

**Environment Configuration**:
```bash
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

---

## Current State Summary

### Available Features

**Drag-and-Drop**:
- ✅ Visual drag with ghost/preview
- ✅ Sequential stage progression enforcement
- ✅ Smooth animations
- ✅ Touch device support
- ✅ Optimistic updates with rollback
- ✅ <100ms latency
- ✅ Concurrent update protection

**Detail Viewer**:
- ✅ Full ticket information display
- ✅ Clear typography and hierarchy
- ✅ Multiple modal dismissal methods
- ✅ Responsive (full-screen mobile, centered desktop)
- ✅ Dark theme styling

**Inline Editing**:
- ✅ Click-to-edit title and description
- ✅ Real-time validation
- ✅ Character counters and warnings
- ✅ Optimistic updates with rollback
- ✅ Concurrent edit protection
- ✅ Success/error notifications

**Workflow Type Tracking**:
- ✅ Automatic detection (INBOX → BUILD = QUICK, other paths = FULL)
- ✅ ⚡ Quick badge on ticket cards
- ✅ Amber styling (light/dark theme support)
- ✅ Badge positioned left of model badge
- ✅ Persistent across stage transitions
- ✅ Atomic transaction with Job creation
- ✅ Immutable after initial setting

**Image Attachments**:
- ✅ Upload images (max 5 per ticket, 10MB each)
- ✅ Supported formats: JPEG, PNG, GIF, WebP
- ✅ Cloudinary CDN storage with public URLs
- ✅ Image gallery with lightbox viewer
- ✅ Replace and delete operations
- ✅ Stage-based access control (SPECIFY/PLAN editable)
- ✅ Image count badge on ticket cards
- ✅ Version-based concurrent edit protection
- ✅ Claude workflow integration (images accessible in prompts)
- ✅ Automatic Cloudinary cleanup on delete/replace

### User Workflows

**Moving a Ticket**:
1. User clicks and holds ticket card
2. Ticket shows ghost/preview while dragging
3. Valid next stage highlights
4. User releases over next stage
5. Ticket moves immediately (optimistic)
6. Database confirms update

**Viewing Ticket Details**:
1. User clicks ticket card
2. Modal opens with full details
3. User reviews title, description, dates, stage
4. User closes modal (button/ESC/click-outside)

**Editing a Ticket**:
1. User clicks ticket to open detail modal
2. User clicks title or description to edit
3. Field becomes editable with focus
4. User makes changes
5. User saves (Enter/click-outside for title, save button for description)
6. Changes save immediately with visual confirmation
7. Board updates to reflect changes

**Managing Ticket Images**:
1. User clicks ticket to open detail modal
2. User views image count badge on ticket card (if images exist)
3. User clicks image badge or opens image gallery tab in modal
4. **Upload**: User clicks upload button → selects image → uploads to Cloudinary → image appears in gallery
5. **Replace**: User clicks replace icon → selects new image → old deleted from Cloudinary → new uploaded → replaces at same position
6. **Delete**: User clicks delete icon → confirms deletion → image removed from gallery and Cloudinary
7. **View**: User clicks image thumbnail → lightbox opens → navigates with prev/next controls
8. Gallery updates immediately with visual confirmation

### Business Rules

**Movement**:
- Sequential stage progression only (one stage forward)
- No skipping stages
- No backwards movement
- Any authenticated user can move any ticket
- First-write-wins for concurrent moves
- Offline: drag-and-drop disabled
- **Job Completion Validation** (added 2025-10-15):
  - Automated stages (SPECIFY, PLAN, BUILD) require completed workflow job before next transition
  - System validates most recent job by `startedAt DESC` to support retry workflows
  - Transitions blocked when job status is PENDING, RUNNING, FAILED, or CANCELLED
  - Transitions allowed when job status is COMPLETED
  - Manual stages (VERIFY, SHIP) and initial transition (INBOX → SPECIFY) bypass validation
  - Error responses include job status, command, and suggested actions
  - Query performance: <50ms using existing composite index [ticketId, status, startedAt]

**Editing**:
- Title: 1-100 characters
- Description: 1-1000 characters
- Both required (no empty values)
- Allowed characters: letters (a-z, A-Z), numbers (0-9), spaces, and special characters (`. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`)
- Rejects emojis, control characters, and other Unicode characters outside allowed set
- Title and description use identical character validation rules
- Version-based conflict detection prevents lost updates
- Optimistic updates with rollback on failure

**Workflow Type** (added 2025-01-16):
- Automatically set during first BUILD transition
- INBOX → BUILD sets `workflowType=QUICK` (quick-implementation path)
- All other paths maintain `workflowType=FULL` (default)
- Immutable after initial setting (application-level enforcement)
- Badge displayed only for QUICK workflow type
- Badge persists through all stage transitions (BUILD → VERIFY → SHIP)
- Atomic transaction with Job creation ensures data consistency

**Image Attachments** (added 2025-01-21):
- Maximum 5 images per ticket (10MB each)
- Supported formats: JPEG, PNG, GIF, WebP only
- Editable only in SPECIFY and PLAN stages
- Read-only in all other stages (INBOX, BUILD, VERIFY, SHIP)
- Cloudinary CDN storage with public HTTPS URLs
- Images accessible to Claude in GitHub Actions workflows via public URLs
- Automatic cleanup: Cloudinary images deleted when replaced or removed
- Version-based conflict detection prevents concurrent edit conflicts
- Fail-safe deletion: Database updates proceed even if Cloudinary delete fails

### Technical Details

**Drag-and-Drop**:
- @dnd-kit/core and @dnd-kit/sortable libraries
- Touch event support
- Optimistic UI with rollback
- Version field for concurrency

**Modal**:
- shadcn/ui Dialog component
- Radix UI primitives
- Responsive breakpoints

**Validation**:
- Zod schemas
- Real-time validation
- Client and server validation

**Image Attachments**:
- Cloudinary SDK v2 (official Node.js SDK)
- TanStack Query v5 for image data fetching and mutation
- React hooks: useTicketImages, useUploadImage, useReplaceImage, useDeleteImage
- Components: ImageGallery (shadcn/ui Dialog + Badge components)
- Storage: Cloudinary CDN with folder structure `ai-board/tickets/{ticketId}/`
- API: RESTful endpoints with multipart/form-data for file uploads
- Validation: Zod schemas for file type, size, and stage permissions
- Concurrency: Version field included in all mutating operations
