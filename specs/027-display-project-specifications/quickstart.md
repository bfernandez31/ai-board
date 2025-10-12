# Quickstart: Display Project Specifications

**Feature**: 027-display-project-specifications
**Date**: 2025-10-12
**Purpose**: User acceptance testing and validation scenarios

## Prerequisites

- Development environment running (`npm run dev`)
- PostgreSQL database with seed data (project ID 3 exists)
- GitHub repository with `/specs/specifications/README.md` file
- GITHUB_TOKEN environment variable configured

## Test Scenario 1: View Specifications from Board

**User Goal**: Access project specifications while viewing the board

**Steps**:
1. Navigate to `http://localhost:3000/projects/3/board`
2. Observe the board header
3. Verify project name "AI Board Development" is displayed
4. Verify document icon (📄) appears next to project name
5. Click the document icon
6. Verify new browser tab opens
7. Verify URL is `/projects/3/specifications`
8. Verify page title shows "Project Specifications - AI Board Development"
9. Verify README.md content displays with proper formatting
10. Verify markdown headers, lists, and code blocks render correctly

**Expected Result**: ✅ Specifications page opens in new tab with formatted markdown

**Validation Criteria**:
- FR-001: Project name visible in board header
- FR-002: Document icon visible in board header
- FR-003: New tab opens on icon click
- FR-004: Correct specifications route
- FR-006: Markdown rendered with react-markdown
- FR-007: Read-only display (no edit buttons)

---

## Test Scenario 2: Direct Navigation to Specifications

**User Goal**: Bookmark and directly access project specifications

**Steps**:
1. Open browser
2. Navigate directly to `http://localhost:3000/projects/3/specifications`
3. Verify page loads without errors
4. Verify README.md content displays
5. Verify no "back to board" navigation button exists (FR-011)
6. Use browser back button to confirm navigation works

**Expected Result**: ✅ Specifications page loads correctly via direct URL

**Validation Criteria**:
- FR-004: Route accessible directly
- FR-008: Project context maintained in URL
- FR-011: No custom navigation controls

---

## Test Scenario 3: Markdown Rendering Validation

**User Goal**: Verify all markdown features render correctly

**Steps**:
1. Navigate to `/projects/3/specifications`
2. Verify the following elements render:
   - [ ] Headers (H1-H6) with proper sizes and styling
   - [ ] Paragraphs with proper spacing
   - [ ] Ordered lists (numbered)
   - [ ] Unordered lists (bulleted)
   - [ ] Code blocks with syntax highlighting
   - [ ] Inline code with monospace font
   - [ ] Links (clickable and properly colored)
   - [ ] Blockquotes (indented with border)
   - [ ] Tables (if present in README)
   - [ ] Horizontal rules
3. Verify dark theme styling (zinc-950/900 background, zinc-50/200 text)
4. Verify syntax highlighting works for code blocks (VS Code Dark+ theme)

**Expected Result**: ✅ All markdown elements display with proper styling

**Validation Criteria**:
- FR-006: Markdown library matches ticket spec viewer
- FR-007: Read-only display (no contenteditable)

---

## Test Scenario 4: Large File Performance

**User Goal**: Verify specifications render smoothly even for large files

**Prerequisites**: README.md is >100KB (add large code examples or tables)

**Steps**:
1. Navigate to `/projects/3/specifications`
2. Observe initial page load time
3. Scroll through entire document
4. Verify smooth scrolling (no lag or jank)
5. Use Cmd+F (browser find) to search within document
6. Verify find works correctly

**Expected Result**: ✅ Large file renders and scrolls smoothly

**Performance Benchmarks**:
- Page load (FCP): <200ms
- API response: <100ms
- Scroll performance: 60fps (no dropped frames)

**Validation Criteria**:
- FR-013: No file size limits enforced

---

## Test Scenario 5: Error Handling - Invalid Project ID

**User Goal**: Verify graceful handling of invalid project IDs

**Steps**:
1. Navigate to `http://localhost:3000/projects/999/specifications` (non-existent project)
2. Verify 404 error page displays
3. Verify error message is user-friendly
4. Navigate to `http://localhost:3000/projects/abc/specifications` (invalid format)
5. Verify 404 error page displays

**Expected Result**: ✅ User-friendly error messages for invalid inputs

**Validation Criteria**:
- API returns 404 with "Project not found" error code
- Next.js notFound() function triggers 404 page

---

## Test Scenario 6: Error Handling - Markdown Rendering Failure

**User Goal**: Verify error display when markdown is invalid

**Prerequisites**: Temporarily modify README.md to include malformed markdown

**Steps**:
1. Add intentionally broken markdown syntax to README.md (e.g., unclosed code blocks)
2. Navigate to `/projects/3/specifications`
3. Verify error message displays: "Unable to render specifications"
4. Verify error message is styled consistently with theme
5. Verify no console errors crash the page

**Expected Result**: ✅ Error message displays instead of broken rendering

**Validation Criteria**:
- FR-012: Error message "Unable to render specifications" on invalid markdown

---

## Test Scenario 7: Multiple Projects

**User Goal**: Verify each project has its own specifications

**Prerequisites**: Multiple projects exist (IDs 1, 2, 3) with different README.md files

**Steps**:
1. Navigate to `/projects/1/specifications`
2. Note the content displayed
3. Navigate to `/projects/2/specifications`
4. Verify different content displays
5. Navigate to `/projects/3/specifications`
6. Verify different content displays
7. Use browser tabs to have all three open simultaneously
8. Verify each tab shows correct project's specifications

**Expected Result**: ✅ Each project displays its own unique specifications

**Validation Criteria**:
- FR-008: Project context maintained in URL
- FR-010: Correct README.md fetched per project

---

## Test Scenario 8: Browser Compatibility

**User Goal**: Verify feature works across major browsers

**Browsers to Test**:
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Steps** (repeat for each browser):
1. Navigate to board page
2. Click document icon
3. Verify new tab opens correctly
4. Verify markdown renders correctly
5. Verify scrolling works smoothly
6. Verify no console errors

**Expected Result**: ✅ Feature works consistently across all browsers

---

## Test Scenario 9: Accessibility Testing

**User Goal**: Verify feature is accessible to keyboard and screen reader users

**Steps**:
1. Navigate to board page using only keyboard (Tab key)
2. Tab to document icon
3. Verify icon has visible focus indicator
4. Press Enter key to activate icon
5. Verify new tab opens
6. Verify page has proper heading structure (H1 → H2 → H3)
7. Enable screen reader (VoiceOver on macOS)
8. Navigate through specifications page
9. Verify headings are announced correctly
10. Verify lists and links are navigable

**Expected Result**: ✅ Feature is fully keyboard and screen reader accessible

**Accessibility Checklist**:
- [ ] Icon is keyboard accessible (tabbable)
- [ ] Focus indicator visible on icon
- [ ] Enter key activates icon (same as click)
- [ ] Page has semantic HTML structure
- [ ] Headings in correct hierarchy
- [ ] Links have descriptive text
- [ ] Code blocks have proper ARIA labels

---

## Test Scenario 10: Mobile Responsive Design

**User Goal**: Verify feature works on mobile devices

**Device Sizes to Test**:
- [ ] Mobile (375x667 - iPhone SE)
- [ ] Tablet (768x1024 - iPad)
- [ ] Desktop (1920x1080)

**Steps** (repeat for each size):
1. Open browser dev tools, set viewport size
2. Navigate to board page
3. Verify header layout adapts (icon doesn't overlap text)
4. Click/tap document icon
5. Verify specifications page is readable
6. Verify horizontal scrolling works for code blocks
7. Verify text doesn't overflow viewport

**Expected Result**: ✅ Feature works well on all screen sizes

---

## Validation Checklist

After completing all scenarios, verify:

### Functional Requirements
- [x] FR-001: Project name displayed in board header
- [x] FR-002: Document icon displayed next to project name
- [x] FR-003: New tab opens on icon click
- [x] FR-004: Route is `/projects/:id/specifications`
- [x] FR-005: Specifications markdown file retrieved
- [x] FR-006: react-markdown library used (same as tickets)
- [x] FR-007: Read-only display (no editing)
- [x] FR-008: Project context in URL (project ID)
- [x] FR-009: Document icon always visible
- [x] FR-010: `/specs/specifications/README.md` fetched
- [x] FR-011: No back navigation button
- [x] FR-012: Error message on invalid markdown
- [x] FR-013: No file size limits

### Non-Functional Requirements
- [x] Performance: <200ms page load, <100ms API response
- [x] Accessibility: Keyboard navigable, screen reader friendly
- [x] Responsive: Works on mobile, tablet, desktop
- [x] Browser Support: Chrome, Firefox, Safari, Edge
- [x] Error Handling: Graceful degradation
- [x] Security: Input validation, no token exposure

---

## Common Issues and Troubleshooting

### Issue 1: "Project not found" error
- **Cause**: Project ID doesn't exist in database
- **Fix**: Run `npm run db:seed` to create test projects

### Issue 2: "Specification file not found" error
- **Cause**: README.md doesn't exist at `/specs/specifications/`
- **Fix**: Create README.md file in project's Git repository

### Issue 3: "GitHub API rate limit exceeded" error
- **Cause**: GITHUB_TOKEN not set or rate limit reached
- **Fix**: Set GITHUB_TOKEN environment variable or wait for limit reset

### Issue 4: Markdown not rendering
- **Cause**: react-markdown or react-syntax-highlighter not installed
- **Fix**: Run `npm install` to install all dependencies

### Issue 5: Icon not appearing
- **Cause**: lucide-react not installed or import missing
- **Fix**: Verify `import { FileText } from 'lucide-react'` in board-header.tsx

---

## Success Criteria

Feature is considered complete when:
1. ✅ All test scenarios pass
2. ✅ All functional requirements validated
3. ✅ No console errors or warnings
4. ✅ All E2E tests pass (Playwright)
5. ✅ Accessibility audit passes (Lighthouse score >90)
6. ✅ Performance benchmarks met

---

## Next Steps

After quickstart validation:
1. Run automated E2E tests: `npm run test:e2e`
2. Run type checking: `npm run type-check`
3. Run linter: `npm run lint`
4. Deploy to staging for final UAT
5. Document any edge cases discovered
