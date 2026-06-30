# Feature Specification: In-App PR Diff Viewer with Layered Grouping (Read-Only)

**Feature Branch**: `AIB-879-visualiseur-de-diff`  
**Created**: 2026-06-30  
**Status**: Draft  
**Input**: User description: "Visualiseur de diff PR in-app avec regroupement par couches (consultation)"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Layer decomposition is persisted by the VERIFY code-review process (not recomputed on open), stored alongside the existing verify quality-score artifact on the relevant completed verify job.
- **Policy Applied**: AUTO
- **Confidence**: High (0.9) — ticket explicitly states grouping is "produit par notre processus de review (pendant VERIFY), pas recalculé à chaque ouverture".
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reuses existing per-job artifact pattern (quality score) — minimal new storage surface.
  2. Layers reflect the review snapshot; files changed afterward need a reconciliation rule (see "Additional changes").
- **Reviewer Notes**: Confirm the layer artifact lives on the same verify job that already carries the quality score, and that consultation triggers no new review/LLM work.

---

- **Decision**: The diff and inline comments shown always reflect the **current** state of the PR, fetched live when the viewer opens; only the layer grouping comes from the stored review snapshot.
- **Policy Applied**: AUTO
- **Confidence**: High (0.9) — ticket states "Le diff et les commentaires affichés doivent refléter l'état courant de la PR".
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Always-fresh diff/comments at the cost of a live fetch on open.
  2. Stored layers can drift from current files → reconciled via "Additional changes" layer.
- **Reviewer Notes**: Validate freshness expectation vs. caching; confirm acceptable load time for large PRs.

---

- **Decision**: Inline comments from all sources are read-only and aggregated from the live PR — our review comments, other review bots, and humans — anchored to their target line; comments whose target line no longer exists in the current diff are shown as "outdated" rather than hidden.
- **Policy Applied**: AUTO → CONSERVATIVE (anchoring of stale comments)
- **Confidence**: Medium (0.6) — sourcing is explicit; handling of orphaned/outdated anchors is not specified, so the cautious choice is to surface (never silently drop) review signal.
- **Fallback Triggered?**: Yes — CONSERVATIVE applied to outdated-comment handling to avoid losing reviewer context.
- **Trade-offs**:
  1. No comment is silently lost; outdated ones are visibly flagged.
  2. Slightly more UI complexity to render an "outdated comments" affordance.
- **Reviewer Notes**: Confirm desired placement for outdated comments (near file header vs. nearest surviving line).

---

- **Decision**: Access to the viewer is governed by existing ticket/project access rules (project owner or member); the PR is identified from the ticket's branch plus the project's repository.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — not stated in ticket; defaulting to the platform's established authorization model.
- **Fallback Triggered?**: Yes — CONSERVATIVE applied to authorization (highest-impact security axis).
- **Trade-offs**:
  1. No new permission surface; consistent with rest of app.
  2. Requires the acting user's GitHub authorization to read the PR.
- **Reviewer Notes**: Confirm behavior when the user lacks GitHub authorization to read the repository.

---

- **Decision**: Scope is strictly read-only consultation with a unified (single-column) diff; posting/editing comments and side-by-side split view are explicitly out of scope for v1.
- **Policy Applied**: AUTO → CONSERVATIVE (scope boundary)
- **Confidence**: High (0.9) — ticket lists these under "Hors périmètre v1".
- **Fallback Triggered?**: Yes — CONSERVATIVE applied to scope (highest-impact axis) to avoid scope creep.
- **Trade-offs**:
  1. Faster, lower-risk v1; reviewers consult without leaving the app.
  2. Composing/replying still requires GitHub until v2.
- **Reviewer Notes**: None.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review a PR's diff in-app, grouped by layers (Priority: P1)

A reviewer working a ticket in the VERIFY or SHIP stage opens a dedicated full-screen view to read the associated pull request's diff without leaving the app. The PR is presented as ordered semantic layers (foundations → business logic → call sites → front-end → tests), each layer showing its files' diffs with syntax highlighting and add/remove counts.

**Why this priority**: This is the core value — consulting the PR diff in-app, organized the way our review already reasons about changes. Without it the feature delivers nothing.

**Independent Test**: Open a ticket in VERIFY that has a reviewed PR; confirm a full-screen viewer opens showing ordered layers, each with title/summary/counters, and selecting a layer renders its files' diffs with syntax highlighting and addition/deletion counts.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY/SHIP with a PR that has been reviewed, **When** the reviewer opens the PR diff viewer, **Then** a full-screen view shows a side rail with Overview/Layers/Files and the diff panel rendered in the same visual style as the existing spec-history diff viewer.
2. **Given** the viewer is in Layers mode, **When** the reviewer selects a layer, **Then** the main panel shows the diff of every file in that layer with syntax highlighting, collapsible per-file blocks, and per-file addition/deletion counts.
3. **Given** a reviewed PR, **When** the reviewer views the layer rail, **Then** each layer shows a title, a short summary, and counters for files and comments, in dependency order.

---

### User Story 2 - See all inline comments anchored to the right line (Priority: P1)

While reading a layer's diff, the reviewer sees inline comments — from our own review, from other review bots, and from humans — displayed read-only at the exact line they target, so the discussion is readable alongside the code.

**Why this priority**: Comments are the substance of a review; reading the diff without the discussion misses most of the value. Equal P1 with the diff itself.

**Independent Test**: Open the viewer for a PR that has comments from multiple sources and confirm each appears anchored to its target line, attributed to its author/source, with no compose/reply controls.

**Acceptance Scenarios**:

1. **Given** a PR with inline comments from our review, a third-party bot, and a human, **When** the reviewer opens the viewer, **Then** all three appear anchored to their respective target lines with author/source attribution.
2. **Given** a comment whose target line no longer exists in the current diff, **When** the diff is displayed, **Then** the comment is shown as outdated rather than omitted.
3. **Given** any displayed comment, **When** the reviewer interacts with it, **Then** no posting, replying, editing, or resolving action is available (read-only).

---

### User Story 3 - Overview and graceful fallbacks (Priority: P2)

The reviewer can open an Overview entry summarizing the PR (title, status, review synthesis, and the existing quality score). When a PR has never been reviewed, or contains files added after the review, the viewer still works: it falls back to a flat Files list, and post-review files are collected into an "Additional changes" layer.

**Why this priority**: Overview adds orientation and the fallbacks guarantee the viewer never errors on un-reviewed or drifted PRs — important for robustness but secondary to seeing diffs and comments.

**Independent Test**: (a) Open the viewer for a never-reviewed PR and confirm a flat Files list with diffs and no error; (b) open a reviewed PR that gained files afterward and confirm those files appear under "Additional changes"; (c) open Overview and confirm PR title, status, review synthesis, and quality score are shown.

**Acceptance Scenarios**:

1. **Given** a PR with no stored layer decomposition, **When** the reviewer opens the viewer, **Then** it displays a flat list of files with their diffs and no error, with Files mode active.
2. **Given** a reviewed PR with files added after the review, **When** the reviewer opens Layers mode, **Then** the unclassified files are grouped under an "Additional changes" layer.
3. **Given** any PR, **When** the reviewer opens the Overview entry, **Then** the PR title, status, review synthesis, and the existing quality score are displayed.
4. **Given** the viewer is open in either mode, **When** the reviewer toggles between Layers and Files, **Then** the same underlying diffs are shown reorganized accordingly.

---

### Edge Cases

- **No PR found for the ticket** (branch has no open/associated PR): the viewer reports that no PR is available rather than erroring.
- **PR already merged/closed (SHIP stage)**: the diff and comments of the PR are still consultable.
- **User lacks GitHub authorization** to read the repository: the viewer shows an actionable authorization message instead of an empty/broken state.
- **Very large PR / very large file diff**: rendering remains responsive (e.g., long or binary diffs are bounded or collapsed by default) and never blocks the view.
- **Binary or generated files with no textual diff**: shown as a file entry with status (added/modified/removed) but without line-level content.
- **Layer present in the review but all its files later removed**: the layer is omitted or shown empty without breaking ordering.
- **Comment anchored to a file not in the current diff**: surfaced as outdated, attributed, never silently dropped.
- **Comment counters vs. displayed comments mismatch** after PR drift: counters reflect what is currently shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: From a ticket in the VERIFY or SHIP stage, users MUST be able to open a dedicated full-screen view showing the diff of the PR associated with that ticket's branch.
- **FR-002**: The view MUST present a side rail offering an **Overview** entry plus a toggle between **Layers** and **Files** modes.
- **FR-003**: The **Overview** entry MUST display PR-level information: title, status, the review synthesis, and the existing quality score.
- **FR-004**: In **Layers** mode, files MUST be grouped into the layers produced by the review, presented in dependency order, each layer showing a title, a short summary, and counters for files and comments.
- **FR-005**: Selecting a layer MUST render, in the main panel, the diff of each file belonging to that layer.
- **FR-006**: In **Files** mode, the view MUST present a flat list of the PR's changed files with their diffs.
- **FR-007**: Each file's diff MUST be rendered with syntax highlighting, collapsible per-file blocks, and per-file addition/deletion counters.
- **FR-008**: The diff rendering MUST be visually consistent with the existing spec-file-history diff viewer (same look and feel).
- **FR-009**: Inline comments MUST be displayed read-only, anchored to the line they target.
- **FR-010**: Displayed comments MUST include comments from all sources: our own review, other review tools/bots, and human reviewers, each attributed to its author/source.
- **FR-011**: The view MUST NOT offer any action to post, reply to, edit, or resolve comments (read-only consultation only).
- **FR-012**: The layer decomposition MUST be produced by the VERIFY review process and persisted; opening the viewer for an already-reviewed PR MUST NOT trigger any new review computation or incur notable additional cost.
- **FR-013**: The diff and comments displayed MUST reflect the current state of the PR at the time the viewer is opened.
- **FR-014**: When no layer decomposition exists for the PR, the view MUST display the flat Files mode with diffs and MUST NOT error.
- **FR-015**: Files changed after the review that are not classified into any layer MUST be grouped into an "Additional changes" layer in Layers mode.
- **FR-016**: Comments whose target line is no longer present in the current diff MUST be surfaced as outdated rather than omitted.
- **FR-017**: Access to the viewer MUST follow existing ticket/project access rules (project owner or member); users without authorization to read the underlying repository MUST see an actionable message rather than a broken view.
- **FR-018**: The diff MUST be presented as a unified (single-column) diff; side-by-side split view is out of scope for v1.

### Key Entities *(include if feature involves data)*

- **PR Diff View**: The full-screen consultation surface for a ticket's PR. Attributes: associated ticket, PR identity (derived from branch + repository), current mode (Overview/Layers/Files), selected layer.
- **Layer (cohort)**: A named group of related changed files produced by the review. Attributes: title, short summary, ordered position (dependency order), member file paths, derived file count and comment count. The synthetic "Additional changes" layer holds files not classified by the review.
- **File Change**: A single changed file within the PR. Attributes: path, change status (added/modified/removed), unified diff content, addition/deletion counts, associated inline comments.
- **Inline Comment**: A read-only comment anchored to a file/line in the PR. Attributes: source (our review / bot / human), author, target file and line, body, outdated flag.
- **Review Synthesis & Quality Score**: PR-level review summary and the existing numeric quality score surfaced in Overview (already produced and stored by the VERIFY review).
- **Layer Decomposition Artifact**: The persisted output of the VERIFY review mapping changed files into ordered, titled, summarized layers, stored with the relevant completed verify job (alongside the existing quality-score artifact).

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **VERIFY Review — Layer Decomposition**: Extends the existing VERIFY code-review process to emit, in addition to the quality score and synthesis, a structured decomposition of the PR's changed files into ordered semantic layers.
  - **Input**: The PR's changed file set and the review's understanding of the change (the same context the review already analyzes during VERIFY).
  - **Phases**: (1) Identify the PR's changed files; (2) group related files into semantic layers (e.g., schema/contracts → business logic → call sites → front-end → tests); (3) order layers by dependency; (4) assign each layer a title and a short summary.
  - **Output**: A persisted layer-decomposition artifact (titled, summarized, ordered layers with their member files), stored with the relevant completed verify job so consultation requires no recomputation.
  - **Error behavior**: If decomposition is unavailable or fails, no artifact is stored; the viewer falls back to flat Files mode. The artifact is a snapshot — later file changes are reconciled at view time via the "Additional changes" layer.
- **PR State Retrieval (on viewer open)**: A read-only retrieval that gathers the current PR diff and all inline comments when the viewer is opened.
  - **Input**: The ticket's branch and project repository; the acting user's authorization.
  - **Phases**: (1) Resolve the PR for the ticket; (2) fetch the current changed files and unified diffs; (3) fetch inline comments from all sources; (4) merge the stored layer decomposition with the current file set, routing unclassified files to "Additional changes"; (5) attach comments to their target lines, flagging those that no longer anchor as outdated.
  - **Output**: The data needed to render Overview, Layers, and Files modes for the current PR state.
  - **Error behavior**: Missing PR → "no PR available" state; missing authorization → actionable authorization message; no stored decomposition → flat Files mode. No data is mutated.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can open a ticket's PR diff and read it entirely in-app without navigating to GitHub for 100% of tickets in VERIFY/SHIP that have an associated PR.
- **SC-002**: For an already-reviewed PR, opening the viewer triggers no new review/analysis work (zero additional review computation cost) and the layered view is ready to read within a few seconds for typical PRs.
- **SC-003**: 100% of inline comments present on the PR (our review, bots, humans) are visible in the viewer — none are silently dropped; comments that no longer anchor are visibly marked outdated.
- **SC-004**: A PR that has never been reviewed opens successfully in flat Files mode with diffs and no error in 100% of cases.
- **SC-005**: Files added after the review are accounted for in 100% of reviewed PRs, appearing under "Additional changes" rather than being missing from Layers mode.
- **SC-006**: Reviewers confirm the diff rendering (syntax highlighting, addition/deletion counters, file blocks) is visually consistent with the existing spec-history diff viewer.
