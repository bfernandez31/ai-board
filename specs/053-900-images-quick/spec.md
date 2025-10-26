# Quick Implementation: 900 images quick
Update the workflow quick-impl to work like in Speckit — implement the workflow when images are attached to the ticket.
Maybe you can use a script like the one we used for the auto PR, and make sure not to duplicate code between workflows.

**Feature Branch**: `053-900-images-quick`
**Created**: 2025-10-26
**Mode**: Quick Implementation (bypassing formal specification)

## Description

900 images quick
Update the workflow quick-impl to work like in Speckit — implement the workflow when images are attached to the ticket.
Maybe you can use a script like the one we used for the auto PR, and make sure not to duplicate code between workflows.

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

### Changes Made

1. **Created reusable image preparation script** (`.specify/scripts/bash/prepare-images.sh`):
   - Downloads images from Cloudinary or external URLs
   - Stores images temporarily in `ticket-assets/<ticket_id>/` directory
   - Returns space-separated list of image paths for Claude
   - Sets `IMAGE_COUNT` and `IMAGE_PATHS` environment variables
   - Supports both "uploaded" (Cloudinary) and "external" attachment types

2. **Updated quick-impl.yml workflow**:
   - Added `attachments` input parameter (JSON array, defaults to `[]`)
   - Added "Prepare Images for Claude" step (calls prepare-images.sh script)
   - Modified "Execute Quick Implementation" step to pass images to Claude
   - Added "Cleanup Temporary Images" step (always runs, removes temporary files)

3. **Updated transition.ts dispatcher**:
   - Added logic to pass `ticket.attachments` to quick-impl workflow
   - Serializes attachments as JSON string for workflow input
   - Matches existing pattern used for speckit workflow

4. **Refactored speckit.yml workflow**:
   - Replaced inline image preparation code with prepare-images.sh script call
   - Eliminated ~80 lines of duplicated code
   - Improved maintainability by centralizing image logic

### Testing

- **Type checking**: ✅ Passed (`bun run type-check`)
- **Linting**: ✅ Passed (`bun run lint`)
- **Code quality**: All changes follow existing patterns and conventions

### How It Works

1. User drags ticket with attachments from INBOX to BUILD column
2. API dispatches quick-impl workflow with attachments JSON
3. Workflow downloads images using prepare-images.sh script
4. Claude receives images as visual context during /quick-impl execution
5. Temporary images are cleaned up after workflow completion
6. Images remain in Cloudinary (not stored in Git repository)

### Benefits

- Quick-impl now has feature parity with speckit for image support
- Single source of truth for image preparation logic
- Reduced code duplication between workflows
- Consistent behavior across both workflow types
- Automatic cleanup prevents repository bloat
