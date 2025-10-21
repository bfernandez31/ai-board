# Feature Specification: Image Management in Ticket Details

**Feature Branch**: `039-consult-update-images`
**Created**: 2025-01-21
**Status**: Draft
**Input**: User description: "Consult/update Images - Je voudrais pouvoir consulter et modifier les images d'un ticket depuis la consultation d'un ticket. La règle pour autoriser ou non la modification des images doit être la même que pour la modification du document spec. Je veux éviter de toujours charger les images, propose moi une solution ergonomique mais aussi optimisée niveau chargement."

## Auto-Resolved Decisions

- **Decision**: Image loading strategy - lazy loading vs. automatic loading
- **Policy Applied**: AUTO
- **Confidence**: High (0.85) - User explicitly requested optimization, performance is a clear priority
- **Fallback Triggered?**: No - User requirements provide clear direction
- **Trade-offs**:
  1. **Scope Impact**: Lazy loading adds complexity (click to view) but respects user's explicit request for load optimization
  2. **UX Impact**: Slight friction (one extra click) vs. faster initial page load and reduced bandwidth
  3. **Performance Impact**: Significant bandwidth savings for tickets with multiple large images
- **Reviewer Notes**: Validate that the lazy loading UX (thumbnail preview + click to expand) provides adequate visual feedback. Consider A/B testing if users find the extra interaction burdensome.

---

- **Decision**: Edit permissions for images - INBOX stage only (updated based on user feedback)
- **Policy Applied**: PRAGMATIC (user clarification after initial implementation)
- **Confidence**: High (0.95) - User explicitly confirmed INBOX-only editing
- **Fallback Triggered?**: No - Clear user requirement
- **Rationale**: Images serve as early context (screenshots, mockups) to inform specification creation. Once ticket moves to SPECIFY stage, images should be locked to maintain specification integrity and prevent confusion.
- **Trade-offs**:
  1. **Workflow Alignment**: Images attached early help spec writers understand requirements
  2. **Immutability**: Once specification starts, images become reference material (read-only)
  3. **Simplicity**: Clear boundary - INBOX for preparation, subsequent stages for execution
- **Implementation**: Permission guard allows 'images' editing only in INBOX stage. All API endpoints (POST/DELETE/PUT) validate via canEdit() function.
- **Reviewer Notes**: This differs from spec/plan document permissions (SPECIFY/PLAN stages). Images have their own permission model based on workflow phase.

---

- **Decision**: Image modification scope - add, remove, replace images
- **Policy Applied**: AUTO (standard CRUD operations)
- **Confidence**: Medium (0.65) - Inferred from "modify" keyword, not explicitly specified
- **Fallback Triggered?**: No - Common sense defaults for image management
- **Trade-offs**:
  1. **Feature Completeness**: Full CRUD coverage vs. simpler "view only" implementation
  2. **Implementation Complexity**: Multi-operation support requires validation, state management
- **Reviewer Notes**: Verify all three operations (add/remove/replace) are needed. If only "replace" is needed initially, consider phased implementation.

## User Scenarios & Testing

### User Story 1 - View Attached Images (Priority: P1)

When working on a ticket specification or implementation, users need to review images that were attached during ticket creation (screenshots, mockups, diagrams) to understand requirements and context.

**Why this priority**: Core functionality - users cannot manage what they cannot see. Viewing images is prerequisite for all other image operations.

**Independent Test**: Can be fully tested by opening a ticket detail modal with attached images and verifying images display correctly. Delivers immediate value by surfacing existing attachment data.

**Acceptance Scenarios**:

1. **Given** a ticket with attached images, **When** user opens ticket details, **Then** user sees a visual indicator (e.g., image count badge, thumbnail preview area) showing images are available
2. **Given** user clicks on image preview/indicator, **When** images load, **Then** all attached images display with filenames and metadata (upload date, file size)
3. **Given** multiple images attached, **When** viewing image gallery, **Then** user can navigate between images (previous/next controls)
4. **Given** images have not been loaded yet (lazy loading), **When** user opens ticket details, **Then** page loads quickly without waiting for image downloads
5. **Given** user wants to view full-resolution image, **When** user clicks thumbnail/preview, **Then** image expands to full size in modal/viewer with zoom controls

---

### User Story 2 - Add New Images to Ticket (Priority: P2)

When clarifying requirements or documenting implementation progress, users need to attach additional images to existing tickets (updated mockups, bug reproduction screenshots, architecture diagrams).

**Why this priority**: Critical for collaborative workflows - enables users to enrich ticket context as work progresses. Depends on P1 (view) being functional first.

**Independent Test**: Can be tested by editing a ticket and uploading new images. Delivers value by enabling continuous context enrichment throughout ticket lifecycle.

**Acceptance Scenarios**:

1. **Given** ticket is in INBOX stage, **When** user opens ticket details, **Then** user sees "Add Image" button in images section
2. **Given** ticket is in SPECIFY, PLAN, BUILD, VERIFY, or SHIP stage, **When** user opens ticket details, **Then** "Add Image" button is hidden and images are read-only
3. **Given** user clicks "Add Image", **When** file picker opens, **Then** only image file types are selectable (jpg, png, gif, webp)
4. **Given** user selects valid image file, **When** upload completes, **Then** new image appears in gallery immediately with upload confirmation
5. **Given** upload fails (network error, file too large), **When** error occurs, **Then** user sees clear error message with retry option

---

### User Story 3 - Remove Unwanted Images (Priority: P3)

When images become outdated or irrelevant (superseded mockups, incorrect screenshots), users need to remove them to keep ticket context clean and focused.

**Why this priority**: Maintenance functionality - important for long-term ticket quality but less critical than view/add operations. Users can work around by ignoring obsolete images temporarily.

**Independent Test**: Can be tested by deleting an attached image from ticket gallery. Delivers value by enabling ticket hygiene and reducing clutter.

**Acceptance Scenarios**:

1. **Given** ticket is in INBOX stage, **When** hovering over image thumbnail, **Then** delete icon/button appears
2. **Given** user clicks delete, **When** confirmation dialog appears, **Then** user can confirm or cancel deletion
3. **Given** user confirms deletion, **When** operation completes, **Then** image is removed from gallery immediately with success notification
4. **Given** deletion fails (network error, file in use), **When** error occurs, **Then** user sees error message and image remains visible

---

### User Story 4 - Replace Existing Image (Priority: P4)

When updating visual assets with newer versions (revised mockup, better screenshot), users need to replace an existing image while maintaining context (same filename, position in gallery).

**Why this priority**: Quality-of-life improvement - users can achieve same result by delete + add, so this is optimization rather than core capability.

**Independent Test**: Can be tested by replacing one image with another. Delivers value by streamlining common update workflow.

**Acceptance Scenarios**:

1. **Given** ticket is in INBOX stage, **When** hovering over image, **Then** "Replace" button appears alongside delete button
2. **Given** user clicks "Replace", **When** file picker opens, **Then** selected file replaces existing image at same position in gallery
3. **Given** replacement succeeds, **When** operation completes, **Then** new image appears with same metadata context (upload timestamp updates, filename may change)

---

### Edge Cases

- What happens when ticket has no images attached? Display empty state with "No images attached" message and optional "Add Image" button (if edit permissions exist)
- How does system handle corrupt image files? Display placeholder "broken image" icon with error message, allow deletion but not viewing
- What happens when user's network connection is slow? Show loading spinner during image download, allow cancel operation, display thumbnails with progressive loading
- How does system handle very large images (>10MB)? Warn user during upload, compress/resize images automatically, or reject files above size limit
- What happens when GitHub storage quota is exceeded? Display storage quota warning, prevent new uploads, provide guidance to delete unused images
- How does lazy loading work with screen readers? Ensure image alt text is available before image loads, announce image count and availability
- What happens when user deletes image while another user is viewing it? Show "image no longer available" message, refresh gallery automatically
- How does system handle simultaneous edits (two users modifying images)? Use optimistic concurrency control (version field), show conflict warning, allow conflict resolution

## Requirements

### Functional Requirements

- **FR-001**: System MUST display image count badge or visual indicator in ticket details when ticket has attached images
- **FR-002**: System MUST implement lazy loading for images (images load only when user requests viewing them, not on ticket details open)
- **FR-003**: System MUST display all attached images with metadata (filename, file size, upload date, MIME type)
- **FR-004**: System MUST enforce INBOX-only edit permissions for image management (images can only be added/deleted/replaced in INBOX stage, read-only in all other stages)
- **FR-005**: Users MUST be able to add new images to tickets when edit permissions allow
- **FR-006**: Users MUST be able to remove existing images from tickets when edit permissions allow
- **FR-007**: System MUST validate uploaded image files (type, size, format) and reject invalid files with clear error messages
- **FR-008**: System MUST persist image metadata in `Ticket.attachments` JSON field following existing `TicketAttachment` schema
- **FR-009**: System MUST store uploaded image files in GitHub repository following existing storage pattern (`ticket-assets/{ticketId}/`)
- **FR-010**: System MUST display loading states during image operations (upload, delete, load)
- **FR-011**: System MUST provide image viewer/lightbox for full-size image viewing with zoom controls
- **FR-012**: System MUST handle image operation errors gracefully (network failures, storage errors, validation errors) with user-friendly messages
- **FR-013**: System MUST support navigation between multiple images (previous/next controls) when ticket has multiple attachments
- **FR-014**: System MUST maintain optimistic concurrency control for image operations (prevent concurrent edit conflicts)

### Key Entities

- **TicketAttachment**: Image metadata stored in `Ticket.attachments` JSON field
  - Attributes: `type` ('uploaded' | 'external'), `url` (GitHub path or external URL), `filename`, `mimeType`, `sizeBytes`, `uploadedAt`
  - Existing schema documented in `app/lib/types/ticket.ts`
- **Image Gallery View**: UI component for displaying image thumbnails/previews
  - State: loading status, selected image, edit mode
  - Behavior: lazy loading, thumbnail generation, full-size viewing
- **Image Upload Operation**: User interaction for adding images
  - Inputs: File selection, ticket ID, project ID
  - Outputs: Updated `Ticket.attachments` array, file stored in GitHub
  - Constraints: File type validation, size limits, permission checks
- **Image Deletion Operation**: User interaction for removing images
  - Inputs: Attachment index/ID, ticket ID, ticket version
  - Outputs: Updated `Ticket.attachments` array, file removed from GitHub (or marked for cleanup)
  - Constraints: Permission checks, optimistic concurrency control

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view attached images within 3 seconds of clicking image preview/indicator (lazy loading performance target)
- **SC-002**: Ticket detail modal initial load time remains under 2 seconds even with 10+ attached images (lazy loading prevents bandwidth bloat)
- **SC-003**: Image upload completes within 5 seconds for files up to 5MB on standard broadband connection (3G fallback: 15 seconds)
- **SC-004**: 95% of image operations (add, remove, replace) succeed on first attempt without errors or retries
- **SC-005**: Image management permissions enforce INBOX-only editing with 100% consistency (no permission bypass in other stages)
- **SC-006**: Users can successfully upload images in all supported formats (JPEG, PNG, GIF, WebP) without errors
- **SC-007**: Page bandwidth usage reduces by 60% compared to auto-loading all images (measured for tickets with 5+ images)
- **SC-008**: Zero permission bypass incidents - users cannot modify images when edit permissions are denied
