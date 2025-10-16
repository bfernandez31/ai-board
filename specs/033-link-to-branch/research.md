# Research: Branch Link in Ticket Details

**Feature**: 033-link-to-branch
**Phase**: 0 - Outline & Research
**Date**: 2025-10-16

## Research Questions

### Q1: How to render external links with Next.js that open in new tabs?

**Decision**: Use standard `<a>` tag with `target="_blank"` and `rel="noopener noreferrer"` instead of Next.js `Link` component

**Rationale**:
- Next.js `Link` component is optimized for internal navigation and client-side routing
- External GitHub URLs should use native anchor tags for proper browser handling
- `rel="noopener noreferrer"` prevents security vulnerabilities (Tabnabbing attack)
- Standard HTML anchor behavior for external resources

**Alternatives Considered**:
- **Next.js Link**: Rejected because it's designed for internal routing and adds unnecessary client-side navigation overhead for external URLs
- **Button with window.open()**: Rejected because it's less accessible and doesn't work with right-click "Open in new tab"
- **Custom Link component**: Rejected because native `<a>` tag is sufficient and more maintainable

**Implementation Pattern**:
```tsx
<a
  href={githubUrl}
  target="_blank"
  rel="noopener noreferrer"
  className="..."
  aria-label="View branch in GitHub"
>
  <GitBranch className="w-4 h-4" />
  View in GitHub
</a>
```

---

### Q2: Which lucide-react icon best represents a GitHub branch link?

**Decision**: Use `GitBranch` icon from lucide-react

**Rationale**:
- `GitBranch` is the standard icon for Git branch visualization
- Consistent with GitHub's own UI iconography
- Clear semantic meaning for developers
- Already available in lucide-react (no additional dependencies)

**Alternatives Considered**:
- **Github icon**: Rejected because it represents GitHub as a platform, not a specific branch
- **ExternalLink icon**: Rejected because it's too generic and doesn't indicate Git/branch context
- **FolderGit2 icon**: Rejected because it represents repositories, not branches

**Icon Usage**:
```tsx
import { GitBranch } from 'lucide-react';

<GitBranch className="w-4 h-4" />
```

---

### Q3: How to construct GitHub branch URLs with proper encoding?

**Decision**: Use standard GitHub URL pattern `https://github.com/{owner}/{repo}/tree/{branch}` with `encodeURIComponent()` for branch name

**Rationale**:
- GitHub's tree view URL structure is stable and well-documented
- `encodeURIComponent()` handles special characters in branch names (slashes, spaces, etc.)
- Native JavaScript function (no dependencies)
- Prevents XSS vulnerabilities from malformed branch names

**Alternatives Considered**:
- **GitHub API**: Rejected because it requires authentication and returns JSON, not a web view
- **Custom URL encoding**: Rejected because `encodeURIComponent()` is the standard and battle-tested
- **No encoding**: Rejected due to security risks (XSS) and broken links for branches with special chars

**Implementation Pattern**:
```tsx
const buildGitHubBranchUrl = (
  owner: string,
  repo: string,
  branch: string
): string => {
  return `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branch)}`;
};

// Usage
const githubUrl = buildGitHubBranchUrl(
  ticket.project.githubOwner,
  ticket.project.githubRepo,
  ticket.branch
);
```

---

### Q4: Where to place the branch link in the ticket detail modal for optimal UX?

**Decision**: Place branch link below description section, above dates section, in its own bordered section

**Rationale**:
- Consistent with existing "View Specification" button placement pattern
- Creates a dedicated "Actions" area in the modal
- Visually separated from editable content (title, description)
- Above metadata (dates) maintains logical information hierarchy
- Matches existing modal section styling (`border-t-2 border-[#313244]/50 pt-6`)

**Alternatives Considered**:
- **Next to stage badge**: Rejected because stage badge area is already crowded with policy badge and edit button
- **In modal header**: Rejected because header is reserved for title and makes modal too busy
- **Floating action button**: Rejected because it's inconsistent with modal design patterns
- **Footer area**: Rejected because footer typically contains close/cancel actions

**Visual Hierarchy** (top to bottom):
1. Title (editable)
2. Stage badge + Policy badge + Edit Policy button
3. Description (editable)
4. **Branch link** (new section) ← Placement
5. View Specification button (existing pattern)
6. Dates section (metadata)

---

### Q5: How to implement stage-based visibility logic?

**Decision**: Use conditional rendering based on `ticket.stage !== 'SHIP'` combined with branch existence check

**Rationale**:
- React conditional rendering is declarative and efficient
- TypeScript Stage enum ensures type safety
- Matches existing pattern in codebase (see `hasCompletedSpecifyJob` pattern in ticket-detail-modal.tsx)
- No unnecessary DOM elements rendered when hidden

**Alternatives Considered**:
- **CSS display:none**: Rejected because it leaves unused DOM elements
- **Separate component**: Rejected because logic is simple and doesn't warrant extraction
- **useEffect state management**: Rejected because visibility is derived state, not user interaction

**Implementation Pattern**:
```tsx
// Conditional rendering
{ticket.branch &&
 ticket.stage !== 'SHIP' &&
 ticket.project?.githubOwner &&
 ticket.project?.githubRepo && (
  <div className="border-t-2 border-[#313244]/50 pt-6">
    <a
      href={buildGitHubBranchUrl(
        ticket.project.githubOwner,
        ticket.project.githubRepo,
        ticket.branch
      )}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 ..."
    >
      <GitBranch className="w-4 h-4" />
      View in GitHub
    </a>
  </div>
)}
```

---

## Best Practices

### Next.js External Links
- Always use `rel="noopener noreferrer"` for `target="_blank"` links
- Prevents Tabnabbing security vulnerability
- Improves performance by preventing referrer header leakage

**Reference**: https://web.dev/external-anchors-use-rel-noopener/

### URL Encoding
- Always encode user-controlled data in URLs
- Use `encodeURIComponent()` for path segments (branch names)
- Use `encodeURI()` only for full URLs (not needed here)

**Reference**: MDN Web Docs - encodeURIComponent()

### Accessibility
- Always provide `aria-label` for icon-only buttons
- Use semantic HTML (`<a>` for links, not `<button>`)
- Ensure sufficient color contrast for text and icons

**Reference**: WCAG 2.1 AA Guidelines

### React Conditional Rendering
- Prefer `&&` operator for simple conditions
- Use ternary for if-else logic
- Always check for both null and empty string when rendering based on string values

**Reference**: React Docs - Conditional Rendering

---

## Technology Choices

### Icon Library: lucide-react
**Why**: Already installed as project dependency, provides GitBranch icon, tree-shakeable, TypeScript support

**Alternatives Considered**:
- react-icons: Rejected (additional dependency)
- Custom SVG: Rejected (maintenance overhead)
- Font Awesome: Rejected (heavier bundle size)

### Styling: TailwindCSS
**Why**: Already project standard, matches existing modal styling, no additional CSS files needed

**Pattern**: Follow existing button styles in ticket-detail-modal.tsx:
```tsx
className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium py-3 flex items-center justify-center gap-2"
```

### Testing: Playwright
**Why**: Already project standard for E2E tests, supports new tab testing via `page.context().waitForEvent('page')`

**Pattern**:
```tsx
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('[data-testid="github-branch-link"]')
]);
await newPage.waitForLoadState();
expect(newPage.url()).toContain('github.com');
```

---

## Security Considerations

### Tabnabbing Prevention
**Vulnerability**: `target="_blank"` without `rel="noopener"` allows opened page to access `window.opener`

**Mitigation**: Always include `rel="noopener noreferrer"`

### XSS Prevention
**Vulnerability**: Unencoded branch names could inject malicious code in URLs

**Mitigation**: Use `encodeURIComponent()` for branch names

### CSRF Prevention
**Not Applicable**: External read-only link, no state-changing operations

---

## Performance Considerations

### Render Performance
- Conditional rendering prevents unnecessary DOM nodes
- No additional API calls (uses existing ticket data)
- Icon is tree-shaken (only GitBranch imported)

**Estimated Impact**: <1ms per modal render

### Bundle Size
- GitBranch icon: ~1KB (tree-shaken)
- No additional dependencies
- URL encoding is native JavaScript (0KB)

**Estimated Impact**: +1KB to bundle

### Network Performance
- No additional network requests
- Opens external GitHub URL in new tab (doesn't affect current page)

**Estimated Impact**: None

---

## Edge Cases Identified

1. **Branch name with spaces**: `encodeURIComponent()` handles spaces → `%20`
2. **Branch name with slashes** (e.g., `feature/login`): `encodeURIComponent()` handles slashes → `feature%2Flogin`
3. **Missing githubOwner/githubRepo**: Conditional rendering prevents broken link
4. **Branch deleted on GitHub**: Link still renders but GitHub shows 404 (acceptable UX)
5. **SHIP stage transition**: Branch link disappears via conditional rendering

---

## Implementation Notes

### Component Modification
**File**: `/components/board/ticket-detail-modal.tsx`
**Lines**: Insert between "View Specification" button and "Dates section" (~line 836)

**Pattern to Follow**:
1. Import `GitBranch` from `lucide-react`
2. Create helper function `buildGitHubBranchUrl()` outside component
3. Add conditional rendering block with `ticket.branch && ticket.stage !== 'SHIP'` guards
4. Use existing styling patterns for consistency

### Test Modification
**File**: `/tests/e2e/ticket-detail-modal.spec.ts` (search first) or create if missing
**Test Cases**:
1. Link visible when branch exists and stage !== SHIP
2. Link hidden when branch is null
3. Link hidden when stage === SHIP
4. Link opens correct GitHub URL in new tab
5. URL encoding works for branch names with special characters

---

## Dependencies

### Existing Dependencies (No Installation Needed)
- lucide-react: ^0.263.1 (provides GitBranch icon)
- Next.js: 15 (React framework)
- TailwindCSS: 3.4 (styling)
- Playwright: (E2E testing)

### No New Dependencies Required

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Branch name encoding fails | Broken link | Low | Use standard `encodeURIComponent()` with test coverage |
| GitHub repository URL changes | All links break | Very Low | GitHub maintains backward compatibility; URL pattern stable since 2008 |
| User lacks GitHub access | 403 error on click | Medium | Acceptable UX (GitHub handles auth); consider tooltip "Requires repository access" |
| SHIP stage tickets need branch access | User confusion | Low | Assumption: SHIP means deployed, branch no longer needed; can be revisited if users report issues |

---

## Open Questions (None Remaining)

All research questions resolved. No blocking issues identified. Ready for Phase 1 (Design & Contracts).
