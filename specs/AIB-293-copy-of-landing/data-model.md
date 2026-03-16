# Data Model: Copy of Landing page

## Overview

This feature does not introduce database entities. The relevant model is the presentation model of the public marketing page and the relationships between sections, calls to action, trust content, and optional motion.

## Entities

### LandingPageSection

**Purpose**: Represents one major content block in the landing page journey.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | string | Stable section anchor or identifier such as `hero` or `pricing`. | Required, unique within the page. |
| `eyebrow` | string \| null | Short orienting label above a section heading. | Optional; if present, concise and descriptive. |
| `heading` | string | Primary heading for the section. | Required; must be scannable and unique in purpose. |
| `supportingText` | string | Short explanatory copy. | Required; must avoid unsupported claims and redundancy. |
| `purpose` | enum | Section role in the page flow. | Required; one of `INTRODUCTION`, `PROOF`, `CAPABILITY`, `WORKFLOW`, `PRICING`, `CONVERSION`. |
| `visualEmphasis` | enum | Relative visual weight. | Required; one of `PRIMARY`, `SECONDARY`, `ACCENT`. |
| `ctaIds` | string[] | CTA identifiers rendered within or immediately after the section. | May be empty only for non-conversion sections. |
| `trustSignalIds` | string[] | Trust signals associated with the section. | Optional; should be present for proof-oriented sections. |
| `motionMode` | enum | Decorative motion usage for the section. | Required; one of `NONE`, `OPTIONAL`, `DECORATIVE_REDUCED_SAFE`. |

**Relationships**:
- One `LandingPageSection` can reference many `PrimaryCallToAction` records.
- One `LandingPageSection` can reference many `TrustSignal` records.
- Sections are ordered to form the visitor narrative.

### PrimaryCallToAction

**Purpose**: Represents a high-importance visitor action.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | string | Stable CTA identifier such as `primary-sign-in`. | Required, unique. |
| `label` | string | User-facing button or link text. | Required; must clearly describe intent. |
| `href` | string | Destination route or in-page anchor. | Required; must map to an existing route or section. |
| `priority` | enum | CTA importance level. | Required; one of `PRIMARY`, `SECONDARY`. |
| `placement` | enum[] | Sections where the CTA appears. | Required; includes at least hero or closing CTA section. |
| `requiresAuth` | boolean | Whether activation depends on authentication. | Required; `false` for public navigation, `true` only if destination initiates auth flow. |

**Relationships**:
- A CTA can appear in multiple sections if the user journey requires repeated conversion opportunities.

### TrustSignal

**Purpose**: Represents a credibility-building content element.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | string | Stable trust-signal identifier. | Required, unique. |
| `title` | string | Short trust label. | Required; concise and specific. |
| `description` | string | Supporting explanation. | Required; must remain factually supportable. |
| `type` | enum | Trust-signal category. | Required; one of `WORKFLOW_SPECIFICITY`, `ARTIFACT_VISIBILITY`, `AUTOMATION_SCOPE`, `TEAM_READINESS`, `PRICING_CLARITY`. |
| `location` | string | Section id where the trust signal appears. | Required; must reference a valid section. |

### MotionSurface

**Purpose**: Represents a decorative or explanatory animated region on the page.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | string | Stable motion-surface identifier. | Required, unique. |
| `componentName` | string | Backing React component name. | Required. |
| `intent` | enum | Why the motion exists. | Required; one of `AMBIENCE`, `WORKFLOW_EXPLANATION`, `CTA_REINFORCEMENT`. |
| `reducedMotionBehavior` | enum | Behavior when users prefer reduced motion. | Required; one of `DISABLE`, `SIMPLIFY`, `STATIC_FALLBACK`. |
| `interactive` | boolean | Whether the surface accepts user input. | Required. |

## State Transitions

### Visitor Journey State

| From | To | Trigger |
|------|----|---------|
| `ARRIVAL` | `UNDERSTANDS_VALUE` | Visitor reads hero and initial proof content. |
| `UNDERSTANDS_VALUE` | `EVALUATES_DIFFERENTIATION` | Visitor scrolls into workflow and capability sections. |
| `EVALUATES_DIFFERENTIATION` | `CHECKS_TRUST` | Visitor reviews proof points, pricing clarity, or artifacts. |
| `CHECKS_TRUST` | `CONVERTS` | Visitor activates primary or secondary CTA. |
| `ANY` | `EXITS` | Visitor leaves before converting. |

## Validation Rules Derived from Requirements

- Every major section must have a distinct purpose and cannot duplicate the preceding section’s message.
- At least one primary CTA must be visible in the hero and one must reappear near the end of the page.
- All CTA labels must remain consistent with the actual destination and current product flow.
- Decorative motion must never be the only way important information is communicated.
- All text and control styling must use semantic Tailwind tokens aligned with the existing palette.
