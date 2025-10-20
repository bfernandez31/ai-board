# Research: Image Attachments for Tickets

**Feature**: Image Attachments for Tickets
**Date**: 2025-10-20
**Researcher**: Claude (Sonnet 4.5)

## Overview

This document captures research decisions for implementing image attachment functionality in the AI Board ticket system. All technical unknowns from the specification have been resolved through analysis of existing codebase patterns, industry best practices, and technology constraints.

## Key Research Areas

### 1. File Upload Implementation in Next.js 15 App Router

**Decision**: Use Next.js 15 API routes with multipart/form-data parsing via `formidable` library

**Rationale**:
- Next.js App Router supports file uploads through Request/Response API
- `formidable` is the standard library for parsing multipart form data in Node.js
- Integrates well with existing API route patterns in the codebase
- Supports streaming for large files (important for 10MB image limit)
- TypeScript support with `@types/formidable`

**Alternatives Considered**:
- **multer**: More Express-oriented, less idiomatic for Next.js App Router
- **busboy**: Lower-level API, more complex to implement correctly
- **next/server**: Native FormData parsing exists but has file size limitations in Vercel's serverless environment

**Implementation Notes**:
- Configure `formidable` with `maxFileSize: 10 * 1024 * 1024` (10MB)
- Use `IncomingForm` to parse uploaded files
- Stream file content directly to GitHub API (avoid writing to disk on Vercel)
- Handle multiple files (up to 5) with proper error handling

### 2. Image Validation Strategy

**Decision**: Multi-layer validation using MIME type check + file signature (magic bytes) verification + Zod schema validation

**Rationale**:
- MIME type alone is unreliable (easily spoofed by changing file extension)
- File signature verification using magic bytes provides cryptographic-level assurance
- Zod schemas provide type-safe validation for attachment metadata
- Defense-in-depth approach prevents malicious file uploads

**Alternatives Considered**:
- **MIME type only**: Insufficient security, easily bypassed
- **File extension only**: Most insecure, never use alone
- **Image processing library (sharp)**: Overkill for validation, adds dependency and processing time

**Implementation Notes**:
- Use `file-type` npm package for magic byte detection
- Validate magic bytes match expected image formats: JPEG (FF D8 FF), PNG (89 50 4E 47), GIF (47 49 46 38), WebP (52 49 46 46), SVG (3C 73 76 67 or 3C 3F 78 6D 6C)
- Create Zod schema `TicketAttachmentSchema` with fields: type, url, filename, mimeType, sizeBytes, uploadedAt
- Reject upload immediately if validation fails (no partial state)

### 3. GitHub API Image Storage Pattern

**Decision**: Use Octokit `repos.createOrUpdateFileContents` API with base64-encoded image content committed to `ticket-assets/[ticket-id]/[filename]`

**Rationale**:
- Existing codebase already uses `@octokit/rest` for GitHub operations
- `createOrUpdateFileContents` supports binary files via base64 encoding
- Atomic commit operation ensures consistency (no orphaned files)
- GitHub automatically handles concurrent commits with conflict resolution
- Path pattern `ticket-assets/[ticket-id]/` provides clear separation and easy cleanup

**Alternatives Considered**:
- **GitHub LFS (Large File Storage)**: Unnecessary complexity for <10MB images, requires separate LFS setup
- **Git submodules**: Overly complex for asset management
- **External storage (S3, Cloudinary)**: Adds dependency, breaks single-source-of-truth principle from spec

**Implementation Notes**:
- Encode image Buffer to base64: `image.toString('base64')`
- Commit message format: `"feat(ticket-{id}): add image attachment {filename}"`
- Use authenticated Octokit instance from existing `lib/github/client.ts`
- Handle GitHub API rate limits (5000/hour authenticated) with exponential backoff
- Transaction pattern: commit all images in single API call or rollback database entry

### 4. Markdown Image URL Extraction

**Decision**: Use regex pattern to extract markdown image syntax `![description](url)` from ticket description field

**Rationale**:
- Markdown is the standard format for ticket descriptions (already supported)
- Regex is sufficient for simple markdown image syntax extraction
- No need for full markdown parser (overkill for single use case)
- Extracted URLs stored alongside uploaded images in same `attachments` JSON array

**Alternatives Considered**:
- **Full markdown parser (remark/unified)**: Excessive dependency for simple pattern matching
- **HTML img tag parsing**: Markdown is the standard, not HTML
- **Manual user input for URLs**: Worse UX than automatic extraction

**Implementation Notes**:
- Regex pattern: `/!\[([^\]]*)\]\(([^)]+)\)/g`
- Extract both alt text (description) and URL
- Validate URLs are absolute and use HTTPS (security)
- Store as `{ type: 'external', url: '...', filename: 'alt-text' }`
- GitHub workflow downloads external URLs during specify stage (separate concern)

### 5. Clipboard Paste Handling

**Decision**: Use browser Clipboard API with paste event listener on image upload component

**Rationale**:
- Modern browsers support `navigator.clipboard` and `paste` event natively
- No external dependencies required (pure browser API)
- Works seamlessly with screenshot tools (Cmd+Shift+4 on macOS, Win+Shift+S on Windows)
- Standard pattern used by GitHub, Slack, Discord, JIRA

**Alternatives Considered**:
- **Third-party clipboard library**: Unnecessary for modern browsers
- **Server-side clipboard access**: Impossible for security reasons
- **Manual file selection**: Worse UX than paste

**Implementation Notes**:
- Add `paste` event listener to image upload component
- Check `event.clipboardData.items` for image MIME types
- Generate filename: `pasted-image-${new Date().toISOString()}.${extension}`
- Convert clipboard item to File object: `item.getAsFile()`
- Pass to existing upload flow (same validation as drag-and-drop)

### 6. Drag-and-Drop Implementation

**Decision**: Use native HTML5 Drag and Drop API with shadcn/ui styling

**Rationale**:
- HTML5 DnD is well-supported in all modern browsers
- No external library needed (reduces bundle size)
- Integrates naturally with shadcn/ui visual design system
- Same pattern used by other modern web apps

**Alternatives Considered**:
- **react-dropzone**: Popular but adds unnecessary dependency for simple use case
- **File input only**: Worse UX, no visual feedback during drag

**Implementation Notes**:
- Implement `onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop` handlers
- Show visual feedback (border color change) during drag
- Prevent default browser behavior (opening image in new tab)
- Extract files from `event.dataTransfer.files`
- Validate immediately after drop before adding to preview

### 7. Image Preview Component Design

**Decision**: Build preview component using shadcn/ui Card + Badge + Button primitives with thumbnail generation via CSS

**Rationale**:
- Reuses existing shadcn/ui components (no custom UI from scratch)
- Consistent with application design system
- Thumbnails via CSS `object-fit: cover` are performant (no server processing)
- Remove button follows shadcn/ui Button patterns

**Alternatives Considered**:
- **Custom preview component from scratch**: Violates constitution (use shadcn/ui)
- **External preview library**: Unnecessary dependency
- **Server-side thumbnail generation**: Adds latency, unnecessary for client preview

**Implementation Notes**:
- Use `Card` for each image preview
- Display: thumbnail (CSS scaled), filename, file size (formatted)
- Remove button: shadcn/ui `Button` with variant="ghost" and X icon
- Layout: Grid or flex layout for multiple images
- Accessibility: alt text for thumbnails, keyboard navigation for remove button

### 8. GitHub Workflow Image Handling

**Decision**: Add new workflow steps to `speckit.yml` for external image download and asset movement

**Rationale**:
- Workflow already handles feature branch creation and spec.md commits
- Natural extension to add image handling steps in same workflow
- Bash scripts are sufficient for file operations (cp, mv, rm, git add/commit)
- Keeps all workflow logic in one place (easier to maintain)

**Alternatives Considered**:
- **Separate workflow for images**: Fragmented logic, harder to synchronize
- **Client-side image movement**: Not possible (client can't modify main branch)

**Implementation Notes**:
- **Step 1** (new): Download external image URLs to `ticket-assets/[id]/` if workflow input includes external URLs
  - Use `curl` or `wget` to download
  - Fallback gracefully if download fails (log warning, continue)
- **Step 2** (existing): Execute `/speckit.specify` command with `imageContext` parameter
  - Pass array of image paths from `ticket-assets/[id]/`
- **Step 3** (existing): Commit spec.md to feature branch
- **Step 4** (new): Move images from main branch to feature branch
  - Checkout main branch
  - Copy `ticket-assets/[id]/` to temp location
  - Delete `ticket-assets/[id]/` from main (git rm)
  - Commit deletion to main branch
  - Checkout feature branch
  - Move temp images to `specs/[branch]/assets/`
  - Commit images to feature branch

### 9. Prisma JSON Field vs. Relation Table

**Decision**: Use Prisma JSON field (`attachments Json?`) on Ticket model instead of separate Attachment table

**Rationale**:
- Attachments are tightly coupled to tickets (no independent lifecycle)
- JSON field simplifies queries (no joins needed)
- Max 5 attachments per ticket keeps JSON payload small (<5KB)
- Prisma supports JSON operations (filtering, validation)
- Easier to migrate later if relation table becomes necessary

**Alternatives Considered**:
- **Separate Attachment table with foreign key**: Over-engineering for simple 1-to-many relationship with fixed max count
- **Store as comma-separated string**: Unsafe, no type validation

**Implementation Notes**:
- Prisma schema: `attachments Json? @default("[]")`
- TypeScript interface: `type TicketAttachment = { type: 'uploaded' | 'external', url: string, filename: string, mimeType: string, sizeBytes: number, uploadedAt: string }`
- Validation: Zod schema ensures JSON structure matches TypeScript interface
- Query pattern: `ticket.attachments as TicketAttachment[]` (type casting after Zod validation)

### 10. Error Handling and Rollback Strategy

**Decision**: Use try-catch with transaction-like rollback pattern for ticket creation + image upload

**Rationale**:
- Prevent orphaned database records if GitHub commit fails
- Prevent orphaned GitHub files if database insert fails
- Constitution requires error handling for all API routes
- Transaction semantics ensure consistency

**Alternatives Considered**:
- **Optimistic creation**: Creates inconsistent state on failure
- **Manual cleanup jobs**: Reactive rather than preventive

**Implementation Notes**:
- Wrap ticket creation + GitHub commits in try-catch
- On GitHub commit failure: do not create ticket in database, return error to user
- On database insert failure: delete committed images from GitHub (compensating transaction)
- Log all errors with context (ticket ID, user ID, image filenames)
- Return structured error: `{ error: "Failed to upload images to repository. Please try again.", code: "GITHUB_COMMIT_FAILED" }`

## Technology Stack Summary

**New Dependencies**:
- `formidable` - Multipart form data parsing for file uploads
- `@types/formidable` - TypeScript definitions
- `file-type` - Magic byte file signature detection

**Existing Dependencies (no changes)**:
- `@octokit/rest` - GitHub API operations
- `zod` - Schema validation
- `@prisma/client` - Database ORM
- `next` - Web framework
- `react` - UI library
- `@radix-ui/*` / `shadcn/ui` - UI components

**Browser APIs Used**:
- HTML5 Drag and Drop API (native)
- Clipboard API (native)
- FormData API (native)

## Risk Assessment

**High Risk**:
- GitHub API rate limits (5000/hour) - mitigate with exponential backoff and user feedback
- Large image uploads (10MB) - mitigate with streaming upload, no disk writes

**Medium Risk**:
- Image validation bypass (malicious files) - mitigate with multi-layer validation (MIME + magic bytes)
- Repository size growth - mitigate with monitoring and future compression strategy

**Low Risk**:
- Browser compatibility for Clipboard API - modern browsers only, graceful degradation
- CORS issues with external image URLs - handle in workflow step with proper error logging

## Next Steps

This research document resolves all technical unknowns. Proceed to:
1. **Phase 1**: Generate data-model.md (Prisma schema, TypeScript interfaces)
2. **Phase 1**: Generate API contracts (OpenAPI schemas for image upload endpoints)
3. **Phase 1**: Generate quickstart.md (developer setup instructions)
4. **Phase 1**: Update agent context (add new technologies to CLAUDE.md)
