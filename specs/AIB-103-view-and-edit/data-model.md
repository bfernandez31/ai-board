# Data Model: View and Edit the Constitution

**Feature Branch**: `AIB-103-view-and-edit`
**Date**: 2025-12-11

## Overview

This feature does **not** require database schema changes. All data is stored in GitHub repositories as markdown files. This document describes the entities and their relationships from an API perspective.

## Entities

### ConstitutionDocument

The markdown file at `.specify/memory/constitution.md` containing project governance principles.

| Property | Type | Description |
|----------|------|-------------|
| content | string | Raw markdown content of the constitution |
| path | string | Fixed: `.specify/memory/constitution.md` |
| sha | string | Git blob SHA for file versioning |

**Source**: GitHub API `repos.getContent()`

**Relationships**:
- Belongs to one Project (via `githubOwner/githubRepo`)
- Has many ConstitutionCommits (via git history)

---

### ConstitutionCommit

A Git commit that modified the constitution file.

| Property | Type | Description |
|----------|------|-------------|
| sha | string | 40-character commit SHA |
| author.name | string | Commit author name |
| author.email | string | Commit author email |
| author.date | string | ISO 8601 timestamp |
| message | string | Commit message |
| url | string | GitHub web URL for commit |

**Source**: GitHub API `repos.listCommits()` with path filter

**Relationships**:
- Belongs to one ConstitutionDocument (via file path filter)
- Has one ConstitutionDiff (fetchable by SHA)

---

### ConstitutionDiff

Changes introduced by a specific commit.

| Property | Type | Description |
|----------|------|-------------|
| sha | string | Commit SHA |
| files[].filename | string | File path changed |
| files[].status | 'added' \| 'modified' \| 'removed' | Change type |
| files[].additions | number | Lines added |
| files[].deletions | number | Lines removed |
| files[].patch | string | Unified diff format |

**Source**: GitHub API `repos.getCommit()`

---

### Project (existing)

Reference to existing Prisma model - no changes required.

| Relevant Properties | Type | Description |
|---------------------|------|-------------|
| id | number | Primary key |
| githubOwner | string | Repository owner |
| githubRepo | string | Repository name |
| userId | number | Owner user ID |

**Relationship to Constitution**: Project's `githubOwner/githubRepo` determines which repository's constitution is accessed.

---

## TypeScript Interfaces

```typescript
// lib/types/constitution.ts

export interface ConstitutionContent {
  content: string;
  sha: string;
  path: string;
  updatedAt?: string;
}

export interface ConstitutionCommit {
  sha: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  message: string;
  url: string;
}

export interface ConstitutionHistoryResponse {
  commits: ConstitutionCommit[];
}

export interface ConstitutionDiffFile {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface ConstitutionDiffResponse {
  sha: string;
  files: ConstitutionDiffFile[];
}

export interface ConstitutionUpdateRequest {
  content: string;
  commitMessage?: string;
}

export interface ConstitutionUpdateResponse {
  success: boolean;
  commitSha: string;
  updatedAt: string;
  message: string;
}
```

---

## Validation Rules

| Field | Rule | Source |
|-------|------|--------|
| content | Max 1MB, valid markdown | FR-005, existing pattern |
| commitMessage | Max 500 chars, optional | Convention |
| sha | 40-char hex string | GitHub API format |

---

## State Transitions

Constitution document has no discrete states - it's always either:
1. **Present**: File exists in repository, viewable and editable
2. **Absent**: File doesn't exist (404 from GitHub), informative message shown

No state machine required.
