# Feature Specification: Insights — Analyze Every Agent Session of a Ticket, Not Just One

**Feature Branch**: `AIB-852-insights-analyser-toutes`
**Created**: 2026-06-07
**Status**: Draft
**Input**: User description: "[Insights] Analyser toutes les sessions d'un ticket, pas qu'une seule — L'analyse Insights est une fonctionnalité admin/plateforme, transverse à TOUS les projets. Aujourd'hui, pour chaque ticket livré (SHIP) sur la période, l'analyse ne retient qu'une seule session d'agent par ticket (la première, typiquement SPECIFY). Les sessions implement/verify/iterate — où se trouvent le vrai travail et les frictions — ne sont jamais analysées. Problèmes connexes: travail non livré invisible (seuls les SHIP entrent), effet de bord de fenêtre (un ticket à la frontière peut être perdu). Attendu: couvrir toutes les sessions de chaque ticket, s'appuyer sur un repère fiable par session, décider l'inclusion des tickets non-SHIP, et rapporter le nombre de sessions analysées vs attendues."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Inclusion of non-shipped tickets — analysis scope is **decoupled from the SHIP transition**. Every Claude agent session (with a captured transcript) whose own completion falls in the analysis period is in scope, regardless of whether its ticket reached SHIP or is in-progress / abandoned / rolled back.
- **Policy Applied**: AUTO → resolved toward inclusion (intent-aligned)
- **Confidence**: Medium (score ≈ 3). The ticket explicitly asks to "decide and document" and states non-shipped sessions "sont souvent les plus instructives", and names the SHIP-only filter as a defect ("travail non livré invisible").
- **Fallback Triggered?**: No — the cautious-on-coverage reading and the intent-aligned reading agree: omitting non-SHIP sessions perpetuates a stated defect, so inclusion is also the lower-data-loss option.
- **Trade-offs**:
  1. Larger analysis corpus (more sessions per run) and a selection rule no longer anchored on the SHIP audit record; richer, more representative diagnosis.
  2. The per-run report mixes shipped and unshipped work; the report must label session outcome/stage so signal is not lost.
- **Reviewer Notes**: Confirm admins want unshipped/abandoned sessions in the platform-level diagnosis. If shipped-only is preferred, this is the single switch to flip — selection re-filters on shipped tickets but MUST still keep all sessions per ticket (the FR-001 fix).

---

- **Decision**: Per-session "already analyzed" bookmark is keyed on a **stable per-session marker** (the session's own identity plus its completion timestamp), replacing the single global period cursor as the source of truth for what has been covered.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score ≈ 5). The ticket explicitly requires "un repère fiable par session (et non sur un curseur global unique)" and "aucune session … ni oubliée ni comptée deux fois".
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Eliminates boundary loss/double-count at the cost of tracking per-session coverage state.
  2. Slightly more bookkeeping than a single timestamp cursor.
- **Reviewer Notes**: Validate the bookmark survives FAILED runs (a failed run must not mark its sessions as covered) and late-arriving transcripts.

---

- **Decision**: Sessions whose transcript is not yet captured/available (no raw artifact) are **excluded from the analyzed set but counted in the "expected" total** so the coverage gap is visible rather than silently dropped.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High. Directly supports the "analysées vs attendues" acceptance criterion and the "no silent truncation" principle.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Coverage counts may show a deficit on recent periods (transcripts upload asynchronously); this is honest reporting.
  2. Uncovered sessions become eligible next run once their transcript lands (no permanent loss).
- **Reviewer Notes**: Confirm the report wording distinguishes "not yet available" from "failed to analyze".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full multi-session ticket is analyzed end to end (Priority: P1)

A platform administrator runs an Insights analysis. The period contains a FULL-workflow ticket that ran several Claude sessions (specify → plan → implement → iterate → verify). The administrator expects the diagnosis to reflect the implementation and verification work — where the real friction occurred — not only the opening specification session.

**Why this priority**: This is the core defect. Without it, every diagnosis rests on the least representative session of each ticket. Fixing this alone delivers the feature's primary value.

**Independent Test**: Seed one ticket with multiple captured Claude sessions across stages, run an analysis for a window covering them, and verify that every one of that ticket's sessions is part of the analyzed corpus (not just the earliest).

**Acceptance Scenarios**:

1. **Given** a ticket with N captured Claude sessions across SPECIFY/PLAN/BUILD/VERIFY in the period, **When** an analysis runs, **Then** all N sessions are included in the analyzed set for that ticket.
2. **Given** a ticket with both an `implement` and a later `iterate` session, **When** an analysis runs, **Then** both sessions are analyzed (the later `iterate` is no longer discarded in favor of the earliest session).
3. **Given** the analysis completes, **When** the report is produced, **Then** the reported session count reflects the total sessions analyzed across all tickets, not the number of tickets.

---

### User Story 2 - No session lost or double-counted at the period boundary (Priority: P1)

An administrator runs analyses back-to-back over time. A session completing right at the boundary between two runs must be analyzed exactly once — never skipped, never counted twice.

**Why this priority**: Boundary loss permanently discards instructive data with no recovery path; double-counting corrupts the diagnosis. Both undermine trust in the feature.

**Independent Test**: Run analysis A over a period, then run analysis B for the following period, with a session timestamped exactly on the shared boundary. Verify the session appears in exactly one of the two runs.

**Acceptance Scenarios**:

1. **Given** a session completing exactly at the boundary between two consecutive analyses, **When** both analyses have run, **Then** the session is included in exactly one of them.
2. **Given** a previous analysis already covered a set of sessions, **When** a new analysis runs, **Then** it covers only sessions not already covered (no re-analysis of previously covered sessions).
3. **Given** an analysis **fails**, **When** a subsequent analysis runs, **Then** the failed run's intended sessions are still treated as not-yet-covered and are picked up (a failed run does not advance coverage).

---

### User Story 3 - Unshipped / in-progress / rolled-back sessions are covered (Priority: P2)

An administrator wants the platform diagnosis to include sessions from tickets that never shipped — in-progress, abandoned, or rolled back in VERIFY — because those often contain the most instructive friction.

**Why this priority**: Addresses the "travail non livré invisible" gap. High value but secondary to the multi-session and boundary fixes; the per-session selection mechanism is the prerequisite that makes it possible.

**Independent Test**: Seed a ticket that never shipped (e.g. rolled back in VERIFY) with captured Claude sessions in the period, run an analysis, and verify those sessions are analyzed.

**Acceptance Scenarios**:

1. **Given** a non-shipped ticket with captured Claude sessions in the period, **When** an analysis runs, **Then** those sessions are included in the analyzed set.
2. **Given** the report is produced, **When** it lists or summarizes coverage, **Then** sessions can be attributed to their ticket and stage regardless of shipped status.

---

### User Story 4 - Report shows analyzed-vs-expected and flags gaps (Priority: P2)

An administrator reads the report and immediately sees how many sessions were analyzed versus how many were expected for the period, and is alerted to any discrepancy.

**Why this priority**: Turns silent coverage loss into a visible, explainable signal; required acceptance criterion.

**Independent Test**: Run an analysis in a period where some in-scope sessions have no captured transcript yet; verify the report states both the analyzed count and the expected count and flags the difference.

**Acceptance Scenarios**:

1. **Given** an analysis completes, **When** the report is shown, **Then** it states the number of sessions actually analyzed and the number expected for the period.
2. **Given** analyzed count < expected count, **When** the report is shown, **Then** the discrepancy is flagged with a reason category (e.g. transcript not yet available).
3. **Given** analyzed count equals expected count, **When** the report is shown, **Then** it indicates full coverage for the period.

---

### User Story 5 - Analysis stays global across all projects (Priority: P1 — guardrail)

The analysis must continue to span every project. It is a platform/harness-level capability and must NOT be re-scoped to a single project by this change.

**Why this priority**: Explicit non-goal protection. Regressing to per-project scope would defeat the feature's purpose.

**Independent Test**: Seed sessions across multiple projects in the period, run an analysis, and verify sessions from all projects are included with no project filter applied.

**Acceptance Scenarios**:

1. **Given** sessions exist across several projects in the period, **When** an analysis runs, **Then** sessions from all projects are included.
2. **Given** the analysis runs, **When** selection is performed, **Then** no project-scoping filter is applied.

---

### Edge Cases

- **Transcript arrives late**: a session in-scope but without a captured transcript at analysis time is counted as expected-but-not-analyzed, and becomes eligible in a later run once its transcript exists (no permanent loss).
- **First-ever analysis**: with no prior coverage marker, the period start defaults to the oldest available captured Claude session so the first run is bounded, not unbounded.
- **Empty period**: no new sessions since last coverage → analysis reports zero analyzed and zero expected (or declines to start) rather than erroring.
- **Same ticket spans two periods**: a ticket's earlier sessions covered in run A and later sessions completing in run B → each session covered once, in the run whose period contains its completion.
- **Non-Claude sessions**: sessions whose effective agent is not Claude remain excluded (no transcript corpus to analyze) and must not inflate the expected count.
- **Concurrent / re-triggered analysis**: a second analysis started while one is running must not double-cover or corrupt the coverage marker.
- **Cancelled/failed sessions with partial transcripts**: included if a transcript was captured; their stage/outcome is labeled so partial work is not mistaken for completed work.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The analysis MUST include **every** captured Claude agent session of each in-scope ticket within the period, not only the earliest/first session per ticket.
- **FR-002**: The analyzed corpus MUST span sessions across the FULL workflow stages (specify, plan, implement, iterate, verify) and the QUICK workflow, wherever a transcript was captured.
- **FR-003**: The analysis MUST remain global across all projects; the system MUST NOT apply a single-project scope filter to session selection.
- **FR-004**: Session selection MUST rely on a stable per-session marker (each session's identity and its own completion time), not on a single global period cursor, to decide what has and has not been covered.
- **FR-005**: Two consecutive analyses MUST NOT overlap (no session analyzed twice) and MUST NOT leave gaps (no in-scope session skipped), including for a session completing exactly at a period boundary.
- **FR-006**: A session MUST be analyzed at most once across the lifetime of all analyses, except when an administrator explicitly requests a re-analysis of a chosen period.
- **FR-007**: A **failed** analysis MUST NOT mark its intended sessions as covered; those sessions MUST remain eligible for the next analysis.
- **FR-008**: Session scope MUST be decoupled from the SHIP transition: sessions of in-progress, abandoned, and rolled-back tickets MUST be eligible for analysis (per the documented Auto-Resolved Decision), subject only to having a captured transcript.
- **FR-009**: A session whose effective agent is not Claude MUST be excluded from both the analyzed set and the expected count.
- **FR-010**: A session in scope but lacking a captured transcript at analysis time MUST be counted toward the "expected" total, excluded from the "analyzed" set, and MUST become eligible again once its transcript becomes available.
- **FR-011**: The report MUST state the number of sessions actually analyzed and the number expected for the period.
- **FR-012**: When analyzed count differs from expected count, the report MUST flag the discrepancy and indicate the reason category (e.g. transcript not yet available).
- **FR-013**: The report MUST attribute each analyzed session to its ticket and workflow stage, and MUST indicate the shipped/unshipped status so unfinished work is distinguishable from shipped work.
- **FR-014**: The first-ever analysis (no prior coverage) MUST be bounded by the oldest available captured Claude session rather than running unbounded.
- **FR-015**: The pre-flight estimate shown before launching an analysis MUST be expressed in **sessions** (consistent with the new per-session selection) and MUST NOT undercount multi-session tickets.
- **FR-016**: The pre-flight count and the count of sessions actually enumerated for analysis MUST be derived from the same selection rule so they cannot drift apart.
- **FR-017**: The chosen scope decision regarding non-shipped tickets MUST be documented in the feature's specification artifacts.

### Key Entities *(include if feature involves data)*

- **Insights Analysis Run**: One execution of the platform analysis over a period. Holds the period boundaries, the analyzed-session count, the expected-session count, status (running/completed/failed), and the produced report artifact. Only a completed run advances coverage.
- **Agent Session**: A single Claude agent run (one job) with a captured transcript, belonging to a ticket and project, carrying its own start/completion time, workflow stage/command, effective agent, and shipped/unshipped context. The unit of selection and counting.
- **Session Coverage Marker**: The per-session record of whether a session has been included in a completed analysis. Source of truth for "already analyzed", replacing the single global cursor for selection decisions.
- **Ticket**: Groups multiple Agent Sessions; provides stage and shipped status for attribution. No longer the unit that caps session selection.
- **Project**: Context/attribution only; never a selection filter for this analysis.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Insights analysis run**: Platform-level, all-projects diagnosis of agent sessions over a period.
  - **Input**: The period to cover, derived from per-session coverage state (start = end of previously covered sessions or oldest available session on first run; end = current moment), plus the set of captured Claude session transcripts whose completion falls in the period and that are not yet covered.
  - **Phases**:
    1. **Determine period & expected set** — compute period bounds and enumerate every in-scope Claude session (all stages, all projects, shipped or not) by per-session marker; record the expected count (including sessions whose transcripts are not yet available).
    2. **Enumerate analyzable sessions** — narrow to sessions with a retrievable transcript; this is the analyzed set.
    3. **Analyze** — process every analyzable session's transcript to produce the platform diagnosis.
    4. **Report & reconcile counts** — produce a report stating analyzed vs expected, flagging and categorizing any gap.
    5. **Advance coverage** — on success only, mark the analyzed sessions as covered so the next run excludes them.
  - **Output**: A report artifact summarizing platform behavior, the analyzed-vs-expected session counts with gap flags, and an advanced coverage state.
  - **Error behavior**: On failure, no session is marked covered; the next run re-attempts the same sessions. Late-arriving transcripts are picked up in a future run. Re-triggering an explicit period is permitted and does not corrupt coverage of other periods.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a ticket with N captured Claude sessions in the period, 100% of those N sessions are present in the analyzed set (previously only 1 of N).
- **SC-002**: Across any two consecutive analyses, every in-scope session is analyzed exactly once — 0 sessions skipped and 0 sessions analyzed twice, including boundary sessions.
- **SC-003**: After a failed analysis, 100% of that run's intended sessions are picked up by the next successful analysis (0 permanent loss from failures).
- **SC-004**: 100% of analyses are global — sessions from every project with in-scope sessions appear, with 0 single-project filters applied.
- **SC-005**: Every completed report displays an analyzed count and an expected count, and flags any difference, in 100% of runs.
- **SC-006**: The pre-flight session estimate and the count of sessions actually enumerated for analysis match for the same period (0 drift), and both count sessions (not tickets).
- **SC-007**: Sessions from non-shipped tickets are included in the analyzed set in 100% of runs where such sessions exist in the period (per the documented scope decision).
