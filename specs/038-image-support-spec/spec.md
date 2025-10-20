# Feature Specification: Image Attachments for Tickets

**Feature Branch**: `038-image-support-spec`
**Created**: 2025-10-20
**Status**: Draft
**Input**: User description: "Image support spec - Enable users to include images (mockups, diagrams, screenshots) when creating tickets, which will be passed to Claude during the specify command execution for better context and more accurate specifications."

## Auto-Resolved Decisions

- **Decision**: Storage location for uploaded images before branch creation
- **Policy Applied**: AUTO (defaulted from no explicit policy input)
- **Confidence**: High (score: 0.85) - architecture context strongly suggests GitHub-based storage
- **Fallback Triggered?**: No - clear architectural pattern exists in codebase
- **Trade-offs**:
  1. Storing in GitHub repo increases repository size but ensures single source of truth
  2. Alternative (external storage service) would add dependency and complexity
- **Reviewer Notes**: Validate that GitHub repository size limits align with expected image volume (10MB per image, max 5 per ticket)

---

- **Decision**: Image file format support
- **Policy Applied**: AUTO (industry standard for web applications)
- **Confidence**: High (score: 0.9) - standard web image formats widely supported
- **Fallback Triggered?**: No - industry standard formats are well-established
- **Trade-offs**:
  1. Supporting common formats (JPEG, PNG, GIF, WebP, SVG) covers 99% of use cases
  2. Exotic formats (TIFF, BMP) excluded to simplify validation and reduce attack surface
- **Reviewer Notes**: Confirm security scanning requirements for uploaded images (malware, steganography)

---

- **Decision**: Maximum file size and attachment count limits
- **Policy Applied**: AUTO (balanced between usability and system constraints)
- **Confidence**: Medium (score: 0.7) - based on typical UI mockup sizes
- **Fallback Triggered?**: Yes - promoted to CONSERVATIVE when considering repository size growth
- **Trade-offs**:
  1. 10MB per image allows high-quality mockups but prevents video/large files
  2. Max 5 images per ticket balances comprehensive context with repository bloat
  3. Lower limits would frustrate users; higher limits risk repository performance
- **Reviewer Notes**: Monitor actual usage patterns and adjust limits if needed; consider compression requirements

---

- **Decision**: Image handling during ticket stage transitions
- **Policy Applied**: AUTO (aligned with existing branch workflow architecture)
- **Confidence**: High (score: 0.85) - consistent with create-new-feature.sh branch creation pattern
- **Fallback Triggered?**: No - follows established workflow pattern
- **Trade-offs**:
  1. Moving images from main to feature branch maintains clean branch separation
  2. Alternative (keeping images on main) would create orphaned assets after merge
  3. Adds workflow complexity but improves long-term repository hygiene
- **Reviewer Notes**: Ensure workflow handles partial failures (e.g., branch creation succeeds but image move fails)

## User Scenarios & Testing

### User Story 1 - Upload Images to New Ticket (Priority: P1)

A product manager creates a new ticket for a UI feature and attaches design mockups directly in the ticket creation modal to provide visual context for the specification.

**Why this priority**: Core value proposition - enables visual context for tickets without external tools. Delivers immediate value as standalone feature.

**Independent Test**: Can be fully tested by creating a ticket with image attachments and verifying images are stored and displayed. Delivers value even if Claude integration is not yet implemented.

**Acceptance Scenarios**:

1. **Given** user is creating a new ticket, **When** they drag-and-drop a PNG mockup into the attachment area, **Then** image preview appears with filename and size, and Remove button is visible
2. **Given** user has attached 4 images, **When** they attempt to attach a 5th image, **Then** 5th image is accepted and attachment counter shows "5/5 images"
3. **Given** user has attached 5 images, **When** they attempt to attach a 6th image, **Then** system displays error "Maximum 5 images per ticket" and rejects the upload
4. **Given** user has attached a 12MB PNG file, **When** they submit the ticket, **Then** system displays error "Image exceeds 10MB limit" and prevents submission
5. **Given** user has attached valid images, **When** they submit the ticket, **Then** ticket is created successfully and images appear in the ticket attachments section

---

### User Story 2 - Reference External Image URLs (Priority: P1)

A developer creates a ticket referencing a Figma design URL or external screenshot hosted elsewhere, avoiding the need to download and re-upload externally hosted images.

**Why this priority**: Supports common workflow where designs exist in external tools (Figma, Miro, screenshots in cloud storage). Enables feature completeness for visual context without forcing all images through upload flow.

**Independent Test**: Can be tested by creating a ticket with markdown image syntax `![description](https://example.com/image.png)` in the description field and verifying the URL is extracted and displayed as an attachment.

**Acceptance Scenarios**:

1. **Given** user pastes markdown image syntax `![Figma mockup](https://figma.com/file/abc123)` in ticket description, **When** they submit the ticket, **Then** system extracts the URL and displays it in the attachments section as "External URL: Figma mockup"
2. **Given** user has both uploaded images and markdown image URLs in description, **When** they view the ticket, **Then** both uploaded images and external URLs appear in the attachments section with clear type labels
3. **Given** ticket has external image URL, **When** specify workflow is triggered, **Then** workflow attempts to download the external image and provides it to Claude (falls back gracefully if download fails)

---

### User Story 3 - Paste Images from Clipboard (Priority: P2)

A user takes a screenshot on their computer and pastes it directly into the ticket description or attachment area using Ctrl+V/Cmd+V, streamlining the workflow without manual file saving.

**Why this priority**: Significantly improves UX for screenshot-heavy workflows (bug reports, UI tweaks). Common pattern in modern web apps (Slack, GitHub, JIRA).

**Independent Test**: Can be tested by capturing a screenshot, pasting via keyboard shortcut, and verifying the image is added as an attachment with auto-generated filename.

**Acceptance Scenarios**:

1. **Given** user has copied an image to clipboard, **When** they press Ctrl+V while focused on the attachment area, **Then** image is added as attachment with filename "pasted-image-[timestamp].png"
2. **Given** user pastes an image from clipboard, **When** the pasted image size exceeds 10MB, **Then** system displays error "Pasted image exceeds 10MB limit" and rejects the paste
3. **Given** user has already attached 5 images, **When** they attempt to paste another image, **Then** system displays error "Maximum 5 images per ticket" and rejects the paste

---

### User Story 4 - Claude Receives Images During Specify Command (Priority: P1)

When a ticket transitions to SPECIFY stage, Claude receives the attached images as context to generate more accurate specifications that reflect the visual design intent.

**Why this priority**: Core integration value - connects image attachments to AI specification generation. This is the primary reason for the feature and must be included in MVP.

**Independent Test**: Can be tested by creating a ticket with an attached UI mockup, triggering `/speckit.specify`, and verifying Claude references the image in the generated specification (e.g., "Based on the provided mockup...").

**Acceptance Scenarios**:

1. **Given** ticket has 2 uploaded images in `ticket-assets/123/` folder, **When** specify workflow is triggered, **Then** workflow passes image paths `["ticket-assets/123/mockup1.png", "ticket-assets/123/mockup2.png"]` to Claude in the `imageContext` parameter
2. **Given** ticket has external image URL `https://figma.com/design.png`, **When** specify workflow is triggered, **Then** workflow attempts to download the URL to `ticket-assets/123/` and includes the local path in `imageContext` (or documents download failure in workflow logs)
3. **Given** specify command completes successfully, **When** the workflow finishes, **Then** images are moved from `ticket-assets/123/` on main branch to `specs/038-image-support/assets/` on the feature branch
4. **Given** specify workflow fails before branch creation, **When** workflow exits with error, **Then** images remain in `ticket-assets/123/` on main branch for retry

---

### User Story 5 - Remove Attached Images Before Submission (Priority: P3)

A user realizes they attached the wrong image or no longer needs an attachment and removes it before submitting the ticket, maintaining clean ticket context.

**Why this priority**: Nice-to-have UX improvement but not critical for MVP. Users can work around by creating a new ticket if they make a mistake.

**Independent Test**: Can be tested by attaching an image, clicking the Remove button, and verifying the image is removed from the preview and not included in the submitted ticket.

**Acceptance Scenarios**:

1. **Given** user has attached 3 images, **When** they click Remove on the 2nd image, **Then** that image is removed from the preview and the remaining 2 images are still visible
2. **Given** user has removed an image, **When** they submit the ticket, **Then** only the remaining attached images are stored (removed images are not uploaded)

---

### Edge Cases

- **What happens when an uploaded image file is corrupted or invalid?**
  System performs file validation during upload (check MIME type and file signature). If validation fails, display error "Invalid image file" and reject the upload. Prevent submission if any attached images fail validation.

- **What happens when external image URL is unreachable during specify workflow?**
  Workflow logs a warning "Failed to download external image: [URL]" and continues execution. Claude receives the URL in `imageContext` but cannot view the image content. Specification generation proceeds with remaining context (description + any successfully downloaded images).

- **What happens when ticket has images but branch already exists (retry scenario)?**
  Workflow checks if images already exist in `specs/[branch]/assets/` on the feature branch. If found, skip the move operation. If not found but images exist in `ticket-assets/[id]/` on main, perform the move operation. Prevents duplicate images and handles partial failure recovery.

- **What happens when user pastes non-image content (e.g., text) via Ctrl+V?**
  System detects clipboard content type. If not an image MIME type, ignore the paste event (allow default browser text paste behavior). Only intercept paste events when clipboard contains image data.

- **What happens when GitHub API commit fails during image upload?**
  Display error to user "Failed to upload images to repository. Please try again." Prevent ticket creation until images are successfully committed to avoid orphaned database records without corresponding files.

- **What happens when ticket is deleted after images are uploaded?**
  If ticket is in INBOX stage (no branch created yet), delete `ticket-assets/[ticket-id]/` folder from main branch during ticket deletion. If ticket has progressed past SPECIFY (branch exists), images remain in feature branch (they are part of the spec documentation).

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow users to attach image files during ticket creation via drag-and-drop, file picker, or clipboard paste (Ctrl+V / Cmd+V)
- **FR-002**: System MUST validate uploaded images meet the following constraints: file size ≤10MB, maximum 5 images per ticket, supported formats (JPEG, PNG, GIF, WebP, SVG)
- **FR-003**: System MUST display image previews with filename, size, and Remove button for each attached image before ticket submission
- **FR-004**: System MUST commit uploaded images to GitHub repository at path `ticket-assets/[ticket-id]/[filename]` on the main branch when ticket is created
- **FR-005**: System MUST extract image URLs from markdown syntax `![description](url)` in ticket description and store them as external URL attachments
- **FR-006**: System MUST include attached images in GitHub Actions workflow payload when ticket transitions to SPECIFY stage
- **FR-007**: Specify workflow MUST move images from `ticket-assets/[ticket-id]/` on main branch to `specs/[branch-name]/assets/` on feature branch after successful branch creation
- **FR-008**: Specify workflow MUST delete `ticket-assets/[ticket-id]/` folder from main branch after successfully moving images to feature branch
- **FR-009**: Specify workflow MUST attempt to download external image URLs to `ticket-assets/[ticket-id]/` before executing Claude command (graceful failure if download fails)
- **FR-010**: System MUST pass image file paths to Claude in `imageContext` parameter as array of objects with `path`, `type` (uploaded/external), and `filename` fields
- **FR-011**: System MUST auto-generate filenames for clipboard-pasted images using pattern `pasted-image-[timestamp].[ext]` where timestamp is ISO 8601 format
- **FR-012**: System MUST prevent ticket submission if any attached images fail validation (file size, format, count limits)
- **FR-013**: System MUST display real-time upload progress and success/error feedback for each image attachment operation
- **FR-014**: System MUST persist attachment metadata (filename, size, MIME type, upload timestamp, storage path/URL) in ticket database record as JSON array

### Key Entities

- **TicketAttachment**: Represents an image attached to a ticket
  - **Attributes**: type (uploaded | external URL), url (GitHub path or external URL), filename, mimeType, sizeBytes, uploadedAt timestamp
  - **Relationships**: Belongs to a Ticket (many attachments per ticket via JSON array in Ticket.attachments field)

- **Ticket (modified)**: Existing entity extended with attachments field
  - **New Attribute**: attachments (JSON array of TicketAttachment objects, nullable, defaults to empty array)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can attach images to tickets in under 10 seconds from drag-and-drop to confirmation (95th percentile, measured via browser performance timing)
- **SC-002**: Image upload success rate exceeds 98% for files meeting validation criteria (tracked via error logs)
- **SC-003**: Claude references attached images in at least 80% of specifications when images are provided (measured by searching spec.md for image path references)
- **SC-004**: Specify workflow successfully moves images to feature branch in 95% of executions (tracked via GitHub Actions workflow logs)
- **SC-005**: Zero orphaned image files in `ticket-assets/` folder on main branch after 90 days of production use (indicates cleanup workflow is reliable)
- **SC-006**: Image preview renders correctly in ticket modal for 100% of supported formats (validated via E2E tests)
- **SC-007**: Users can create tickets with images without external documentation or support requests (measured by support ticket volume)
