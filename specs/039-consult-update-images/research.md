# Research Findings: Image Management in Ticket Details

**Feature**: Image Management in Ticket Details
**Branch**: `039-consult-update-images`
**Date**: 2025-01-21

## Research Overview

This document consolidates all technical research conducted during Phase 0 planning for the image management feature. Each decision is documented with rationale, alternatives considered, and implementation recommendations.

## 1. Image Lazy Loading Strategy

### Question
How to implement performant lazy loading without loading all images when the ticket detail modal opens?

### Decision
**Two-phase loading approach**:
1. **Phase 1 (Immediate)**: Load image metadata from `Ticket.attachments` JSON field (already in database response)
2. **Phase 2 (On-demand)**: Fetch actual image files only when user clicks "View Images" section

### Rationale
- `Ticket.attachments` array is already included in the ticket API response, so metadata is "free"
- No additional API call needed for metadata display (image count badge, filenames)
- Actual image files fetched via separate endpoint (`GET /api/projects/:projectId/tickets/:id/images`) only when user expands gallery
- Respects user's explicit request for bandwidth optimization (60% reduction target)

### Alternatives Considered

**Option 1: Browser Native Lazy Loading** (`loading="lazy"` attribute)
- **Rejected**: Images are still added to DOM and downloaded in background, just prioritized differently
- Would not achieve 60% bandwidth reduction target
- No control over "when" images load (browser decides)

**Option 2: Intersection Observer API**
- **Rejected**: Over-engineered for click-based lazy loading
- Better suited for scroll-based lazy loading (infinite lists, etc.)
- Adds unnecessary complexity when user explicitly clicks to view

**Option 3: Load thumbnails first, full-size on click**
- **Considered but deferred**: Would require server-side image resizing/thumbnail generation
- Adds complexity to GitHub storage and API layer
- Can be added in future iteration if needed

### Implementation Recommendations
- Display image count badge in ticket header (e.g., "3 images")
- Collapsible "Images" section in modal (collapsed by default)
- Clicking section header fetches images via TanStack Query
- Loading spinner while images download
- Images cached by TanStack Query for subsequent views

---

## 2. Image Upload Flow

### Question
Should image upload happen immediately when user selects file, or batched when modal closes/ticket saves?

### Decision
**Immediate upload with optimistic UI update**

### Rationale
- Consistent with existing ticket creation flow (attachments upload immediately during creation)
- Provides instant feedback to user (no waiting until modal close)
- Reduces risk of data loss (uploaded immediately vs. lost if modal closed without saving)
- Enables progressive upload of multiple images (upload while user continues working)

### Alternatives Considered

**Option 1: Batch upload on modal close**
- **Rejected**: Poor UX - user doesn't know if upload succeeded until they try to close modal
- Risk of data loss if user closes modal accidentally
- All uploads fail together if network error during batch

**Option 2: Upload on "Save" button click**
- **Rejected**: No explicit "Save" button for images (follows inline editing pattern)
- Inconsistent with ticket title/description inline editing model

### Implementation Recommendations
- File picker opens when user clicks "Add Image" button
- Upload starts immediately after file selection
- Optimistic UI: Show image in gallery with loading state during upload
- TanStack Query mutation handles upload with automatic retry
- Error toast if upload fails, with option to retry
- Uploaded image persisted in `Ticket.attachments` immediately

---

## 3. Permission Model Alignment

### Question
How do spec document editing permissions map to image editing permissions?

### Decision
**Images editable in SPECIFY and PLAN stages only** (same as spec/plan document editing)

### Permission Matrix

| Stage   | View Images | Add | Remove | Replace | Rationale |
|---------|-------------|-----|--------|---------|-----------|
| INBOX   | ✅ Yes      | ❌ No | ❌ No   | ❌ No    | View images added during ticket creation |
| SPECIFY | ✅ Yes      | ✅ Yes | ✅ Yes  | ✅ Yes   | Active specification phase - images needed for requirements |
| PLAN    | ✅ Yes      | ✅ Yes | ✅ Yes  | ✅ Yes   | Active planning phase - mockups and diagrams may change |
| BUILD   | ✅ Yes      | ❌ No | ❌ No   | ❌ No    | Implementation phase - requirements locked |
| VERIFY  | ✅ Yes      | ❌ No | ❌ No   | ❌ No    | Testing phase - requirements locked |
| SHIP    | ✅ Yes      | ❌ No | ❌ No   | ❌ No    | Deployment phase - requirements locked |

### Rationale
- User explicitly requested "same rule as spec document editing"
- Matches existing `canEdit()` function in `components/ticket/edit-permission-guard.tsx`
- Spec documents editable in SPECIFY stage, plan documents editable in PLAN stage
- Images are specification artifacts (mockups, screenshots, diagrams) so follow same lifecycle
- Simplifies user mental model (one permission rule for all ticket content)

### Alternatives Considered

**Option 1: Allow editing in BUILD stage**
- **Rejected**: Inconsistent with spec editing model
- Would allow changing requirements after implementation started
- User explicitly requested consistency

**Option 2: Always allow editing (no stage restrictions)**
- **Rejected**: Violates requirement for permission parity with spec editing
- Could lead to confusion (why can I edit images but not spec in BUILD stage?)

### Implementation Recommendations
- Reuse `canEdit()` function from `components/ticket/edit-permission-guard.tsx`
- Add new document type: `'images'` alongside `'spec'`, `'plan'`, `'tasks'`
- Update permission matrix to include images in SPECIFY and PLAN stages
- Show/hide "Add Image" button based on `canEdit(ticketStage, 'images')`
- Disable delete/replace buttons when editing not allowed

---

## 4. Image Storage Location

### Question
Where should uploaded image files be stored in the GitHub repository?

### Decision
**Use existing `ticket-assets/{ticketId}/` directory pattern**

### Rationale
- Pattern already implemented in ticket creation flow (see `app/api/projects/[projectId]/tickets/route.ts`)
- GitHub repository already configured for image storage
- Consistent file organization: all images for a ticket in one directory
- Easy cleanup: delete entire `ticket-assets/{ticketId}/` directory when ticket deleted
- Supports both uploaded images and external URL references (existing `TicketAttachment` schema)

### Directory Structure Example
```
ai-board-repo/
├── images/
│   ├── 1/                  # Ticket ID 1
│   │   ├── screenshot.png
│   │   └── mockup.jpg
│   ├── 2/                  # Ticket ID 2
│   │   └── diagram.png
│   └── 123/                # Ticket ID 123
│       ├── bug-repro.png
│       └── architecture.svg
```

### Alternatives Considered

**Option 1: Flat `/images/` directory**
- **Rejected**: Poor organization at scale (hundreds of tickets → hundreds/thousands of images in one folder)
- Harder to clean up when ticket deleted
- No clear ownership/grouping

**Option 2: External storage (S3, Cloudinary, Imgix)**
- **Rejected**: Avoids new dependencies per constitution principle
- Adds cost (external service)
- Requires credential management and API integration
- GitHub repository storage sufficient for current scale

**Option 3: Base64 embed in database**
- **Rejected**: Bloats database, poor performance for large images
- No caching benefits (images re-fetched on every query)
- PostgreSQL JSON field not designed for binary data

### Implementation Recommendations
- Store GitHub file path in `TicketAttachment.url` field
- Format: `https://github.com/{owner}/{repo}/blob/{branch}/ticket-assets/{ticketId}/{filename}`
- Use `@octokit/rest` library for GitHub API interactions (already in dependencies)
- Implement file cleanup strategy (delete images when ticket deleted - out of scope for this feature)

---

## 5. Concurrent Edit Handling

### Question
How to prevent concurrent modification conflicts when multiple users edit images simultaneously?

### Decision
**Reuse existing `ticket.version` optimistic concurrency control**

### Rationale
- `Ticket.attachments` is part of ticket record (JSON field)
- Existing `ticket.version` field already protects all ticket updates (title, description, attachments)
- No new database fields or locking mechanisms needed
- Consistent with existing ticket editing behavior
- Well-tested pattern already in use for title/description edits

### Conflict Resolution Flow
1. User A fetches ticket (version=5, attachments=[img1.png])
2. User B fetches ticket (version=5, attachments=[img1.png])
3. User A adds img2.png → version=6, attachments=[img1.png, img2.png]
4. User B tries to add img3.png with version=5 → **409 Conflict**
5. User B sees error: "Ticket modified by another user. Refreshing..."
6. User B's ticket data refreshes to version=6, attachments=[img1.png, img2.png]
7. User B can now add img3.png with version=6 → version=7, attachments=[img1.png, img2.png, img3.png]

### Alternatives Considered

**Option 1: Per-image locking**
- **Rejected**: Over-engineered for current use case
- Requires tracking which user is editing which image
- Adds state management complexity (distributed locks, timeouts)
- Attachments array is small (typically <10 images per ticket)

**Option 2: Last-write-wins (no conflict detection)**
- **Rejected**: Risk of data loss
- User A's changes silently overwritten by User B
- No notification to users that their changes were lost
- Violates existing ticket editing consistency

### Implementation Recommendations
- Include `version` field in all image mutation requests (upload, delete, replace)
- API validates version matches current ticket version before applying changes
- Return 409 Conflict if version mismatch detected
- Client receives conflict error → refreshes ticket data → retries with new version
- TanStack Query mutation automatically refetches ticket on conflict error
- Show toast notification: "Ticket was updated by another user. Please try again."

---

## 6. Image Viewer/Lightbox Component

### Question
Should we build a custom image lightbox or use an existing library?

### Decision
**Build custom lightbox using shadcn/ui Dialog component**

### Rationale
- Avoids new npm dependencies (per constitution principle)
- Matches existing modal/dialog patterns in app (consistent UX)
- Full control over styling and behavior (Catppuccin Mocha theme)
- Simple requirements: full-size view, zoom, navigation (no video, no galleries, no advanced features)
- shadcn/ui Dialog provides keyboard navigation, focus trap, accessibility

### Feature Requirements

**Must Have**:
- Full-size image display
- Previous/next navigation (when multiple images)
- Close button + ESC key
- Click outside to close
- Keyboard navigation (arrow keys for prev/next)
- Zoom controls (fit-to-screen, 100%, 200%)
- Loading state while image downloads

**Nice to Have** (defer to future iteration):
- Pinch-to-zoom on mobile
- Image rotation controls
- Download button
- Slideshow mode

### Alternatives Considered

**Option 1: react-image-lightbox**
- **Rejected**: Adds dependency (17KB gzipped)
- Opinionated styling may conflict with Catppuccin theme
- Features we don't need (video support, thumbnails, etc.)

**Option 2: photoswipe**
- **Rejected**: Heavy dependency (60KB gzipped)
- Complex API, overkill for simple use case
- Designed for photo galleries, not ticket attachments

**Option 3: yet-another-react-lightbox**
- **Rejected**: Still adds dependency
- More features than needed

### Implementation Recommendations
- Create `ImageLightbox` component extending shadcn/ui Dialog
- Props: `open`, `onOpenChange`, `images[]`, `initialIndex`
- State: `currentIndex`, `zoomLevel`
- Render current image in Dialog with controls overlay
- Previous/Next buttons disabled at array boundaries
- Zoom controls: Fit, 100%, 200% (use CSS transform scale)
- Preload adjacent images for smoother navigation (new Image() in background)

---

## 7. Best Practices for Image Handling

### Research: Industry Standards for Web Image Management

**File Size Limits**:
- **Recommendation**: 10MB max per image (spec edge case mentions this)
- GitHub API file size limit: 100MB (well above our needs)
- Typical screenshot: 100KB - 2MB
- Typical mockup: 500KB - 5MB
- Reject files >10MB with clear error message

**Supported Formats**:
- JPEG (.jpg, .jpeg) - photos, screenshots
- PNG (.png) - UI mockups, diagrams with transparency
- GIF (.gif) - simple animations (use sparingly)
- WebP (.webp) - modern format, better compression
- **Reject**: TIFF, BMP, SVG (security risk - can contain scripts)

**MIME Type Validation**:
- Server-side validation using `file.type` from multipart upload
- Allowed: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Double-check file extension matches MIME type (prevent mime type spoofing)

**Accessibility**:
- Store `filename` as alt text fallback
- Allow users to edit alt text in future iteration (not MVP)
- Announce image count to screen readers ("3 images attached")

**Performance Optimization**:
- Browser caching headers for GitHub-served images (Cache-Control: max-age=31536000)
- TanStack Query caching for image metadata (staleTime: 5 minutes)
- Progressive image loading (show low-res placeholder while full-res loads - defer to future)

### Security Considerations

**File Upload Security**:
- Validate MIME type server-side (don't trust client)
- Validate file extension matches MIME type
- Sanitize filename (remove special characters, path traversal attempts)
- Limit upload rate (prevent abuse - defer to future)

**Content Security Policy**:
- Images served from same GitHub domain (no external CSP issues)
- External image URLs (if allowed) must be validated and potentially proxied

**Authentication**:
- All image endpoints require authenticated session
- Verify project ownership before allowing image access
- No public image URLs (requires authentication)

---

## Summary of Key Decisions

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| Lazy Loading | Two-phase: metadata immediate, images on-demand | Bandwidth optimization, user request |
| Upload Flow | Immediate upload with optimistic UI | Consistent with existing flow, instant feedback |
| Permissions | SPECIFY and PLAN stages only | Parity with spec document editing |
| Storage | GitHub `ticket-assets/{ticketId}/` | Existing pattern, consistent organization |
| Concurrency | Reuse `ticket.version` field | Proven pattern, no new mechanisms |
| Lightbox | Custom using shadcn/ui Dialog | No dependencies, full control, consistent UX |
| File Size Limit | 10MB max | Reasonable for mockups/screenshots |
| Supported Formats | JPEG, PNG, GIF, WebP | Standard web formats, security |

All decisions align with constitution principles and existing codebase patterns.
