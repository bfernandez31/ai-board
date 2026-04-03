# Research: Setup Wizard — Auto-Detection + Questionnaire + File Commit

**Ticket**: AIB-472
**Date**: 2026-04-03

---

## Research 1: Atomic Multi-File Commit via GitHub API

**Context**: The spec requires committing 3 files (config.yml, CLAUDE.md, constitution.md) as a single atomic commit to the default branch. The existing codebase only uses `createOrUpdateFileContents` which creates one commit per file.

**Decision**: Use the GitHub Git Data API (tree + commit + ref update) for atomic multi-file commits.

**Rationale**: The design doc explicitly states "Single commit: `chore: initialize ai-board configuration`". Using `createOrUpdateFileContents` would create 3 separate commits. The Git Data API (`createTree` → `createCommit` → `updateRef`) batches all file changes into one commit. This also aligns with Decision 1 in the spec (atomic rollback on failure — if the commit fails, no files are partially committed).

**Alternatives Considered**:
1. Sequential `createOrUpdateFileContents` calls — rejected because it creates 3 commits and leaves partial state on failure
2. GitHub GraphQL `createCommitOnBranch` mutation — viable but less documented; REST approach is more consistent with existing Octokit patterns

**Implementation Pattern**:
```typescript
// 1. Get latest commit SHA on default branch
const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });
const latestCommitSha = ref.object.sha;

// 2. Get base tree
const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
const baseTreeSha = commit.tree.sha;

// 3. Create new tree with all 3 files
const { data: tree } = await octokit.git.createTree({
  owner, repo, base_tree: baseTreeSha,
  tree: files.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
});

// 4. Create commit
const { data: newCommit } = await octokit.git.createCommit({
  owner, repo,
  message: 'chore: initialize ai-board configuration',
  tree: tree.sha,
  parents: [latestCommitSha],
});

// 5. Update branch ref
await octokit.git.updateRef({ owner, repo, ref: `heads/${defaultBranch}`, sha: newCommit.sha });
```

---

## Research 2: Auto-Detection Strategy via GitHub API

**Context**: The wizard must detect language, framework, package manager, services, test frameworks, and commands — all via GitHub REST API without cloning the repo.

**Decision**: Use a parallel detection strategy with independent detectors that each query specific GitHub API endpoints. Each detector is fault-tolerant — failures return empty results.

**Rationale**: Detection queries are independent (language stats, file presence, file content). Running them in parallel minimizes latency. Using `Promise.allSettled` ensures one failure doesn't block others (FR-002).

**Detection Map**:

| Detection | GitHub API Call | Parse Logic |
|-----------|----------------|-------------|
| Language | `GET /repos/{o}/{r}/languages` | Top language by bytes → map to config enum |
| Framework | `GET /repos/{o}/{r}/contents/package.json` | Parse deps for known frameworks |
| Package Manager | `GET /repos/{o}/{r}/contents/` (root listing) | Check for `bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`, `package-lock.json`, `Pipfile.lock`, `poetry.lock`, `Cargo.lock` |
| Runtime Version | `GET /repos/{o}/{r}/contents/.nvmrc` or `.node-version` | Parse version string |
| Services | `GET /repos/{o}/{r}/contents/docker-compose.yml` + `prisma/schema.prisma` | Parse for postgres/redis/mysql/mongo images or datasource |
| Test Frameworks | `GET /repos/{o}/{r}/contents/` (root listing) | Check for `vitest.config.*`, `jest.config.*`, `pytest.ini`, `playwright.config.*` |
| Commands | `GET /repos/{o}/{r}/contents/package.json` | Parse `scripts` object |

**For non-JS repos** (Python, Go, Rust, Java): Use analogous files:
- Python: `requirements.txt`, `pyproject.toml`, `setup.py` for deps; `Pipfile.lock`/`poetry.lock` for manager
- Go: `go.mod` for deps
- Rust: `Cargo.toml` for deps
- Java/Kotlin: `pom.xml` (Maven) or `build.gradle` (Gradle)

**Alternatives Considered**:
1. Clone repo and analyze locally — rejected (too slow, unnecessary for detection)
2. Use GitHub GraphQL API — viable but adds complexity; REST is sufficient for file reads

---

## Research 3: File Generation Templates

**Context**: Three files are generated from wizard answers. Templates must be flexible enough for different tech stacks.

**Decision**: Use string template functions (TypeScript template literals) that take the wizard state as input and produce file content. No templating engine needed.

**Rationale**: The templates are simple enough that template literals suffice. Adding a templating library (Handlebars, etc.) would be over-engineering. The existing codebase doesn't use a template engine.

**Template Outputs**:

1. **`.ai-board/config.yml`** — Direct YAML serialization from wizard state using `js-yaml` (already a transitive dependency via config-sync.ts YAML parsing). Follows the schema in `lib/validations/config.ts`.

2. **`CLAUDE.md`** — Markdown template per design doc Section 6. Sections: Tech Stack, Commands, Data Models (conditional on Prisma detection), Testing instructions.

3. **`.ai-board/constitution.md`** — Default template per design doc Section 6. Minimal project constitution with core principles.

**Alternatives Considered**:
1. Handlebars templates stored as files — rejected (adds dependency, templates are simple)
2. YAML builder library — rejected (`js-yaml.dump()` is sufficient)

---

## Research 4: Existing File Detection and Diff Display

**Context**: When files already exist in the repo, the wizard must show diffs and allow skip per file (Decision 2, FR-010, FR-011).

**Decision**: Fetch existing file contents during auto-detection phase. Use a lightweight client-side diff library for display.

**Rationale**: The GitHub Contents API already returns file content (base64). Fetching during detection avoids extra API calls at preview time. For diff display, a simple line-by-line diff is sufficient — no need for a full Monaco editor.

**Implementation**:
- During detection, attempt to fetch each of the 3 target files
- Store existing content + SHA (needed for update commits)
- At preview, if existing content exists, render a unified diff view
- Each file gets a "skip" toggle (defaults to unchecked for new files, checked for existing unchanged files)

**Diff Library Options**:
1. `diff` npm package — lightweight, produces unified diffs
2. Custom simple diff — too complex to build correctly
3. Monaco diff editor — too heavy for this use case

**Decision**: Use the `diff` npm package (or inline a simple side-by-side comparison component using string comparison). Given the files are config/markdown (not code), a simple "current vs new" side-by-side view may be cleaner than a unified diff.

---

## Research 5: Wizard State Management

**Context**: 4-step wizard with form state that must persist across steps and survive commit failures (FR-013).

**Decision**: Use React `useState` at the wizard page level. No persistence to server or localStorage.

**Rationale**: The spec explicitly states "Form state is not persisted. Returning to the setup page starts fresh" (Edge Cases). The only persistence requirement is surviving commit failures — which is naturally handled by keeping state in the parent component (the commit is an async operation, state remains in React tree on failure). This matches the existing import modal pattern (`useState` for step tracking).

**Alternatives Considered**:
1. Server-side session storage — rejected (over-engineering, spec says no persistence)
2. localStorage — rejected (spec says returning starts fresh)
3. URL search params — rejected (too much state for URL encoding)

---

## Research 6: Setup Page Redirect Logic

**Context**: Users must be redirected to setup when config is missing, and skip it when config exists (FR-014).

**Decision**: Reuse the existing redirect logic in the import API (`redirectTo` field). Add a server-side check on the setup page itself to redirect to board if config already exists.

**Rationale**: The import API already returns `redirectTo: /projects/{id}/setup` when `hasConfig` is false (confirmed in codebase). The setup page needs its own guard for direct URL access.

**Implementation**:
- Import API: already handled (returns setup redirect when no config)
- Setup page: server component checks `project.config` — if present, redirect to `/projects/{id}`
- Board page: no changes needed (already works with config)

---

## Research 7: User Authentication for GitHub API Calls

**Context**: Auto-detection and file commits require authenticated GitHub API calls using the user's OAuth token (must have `repo` scope for private repos and write access).

**Decision**: Use `createUserGitHubClient(userId)` from `lib/github/user-client.ts` for all GitHub operations. Require `repo` scope via `requireRepoScope()`.

**Rationale**: This is the established pattern in the codebase. The user's token is already stored in the NextAuth `Account` model. The import flow already validates repo scope before redirect.

**No new patterns needed** — reuse existing `user-client.ts` utilities.
