# Research: Copy of Landing page

## Decision 1: Keep the landing page server-rendered and use client components only for optional motion or menu behavior

**Decision**: Preserve `app/page.tsx` and `app/landing/page.tsx` as server-rendered entry points, and limit client-side behavior to existing interactive components such as the shared header mobile menu and optional animated demos.

**Rationale**: The public homepage benefits from immediate content rendering and straightforward semantic structure. The current architecture already uses a server component container for the landing page, which supports fast first paint and keeps the core message visible without waiting for hydration.

**Alternatives considered**:
- Convert the landing page to a large client component. Rejected because the page’s main job is content delivery, not client state orchestration.
- Add new animation-heavy hero logic. Rejected because the feature prioritizes comprehension and accessibility over motion complexity.

## Decision 2: Preserve the existing Catppuccin-derived palette, but eliminate hardcoded color classes from landing-specific components

**Decision**: Use semantic tokens such as `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`, and existing token-backed utility classes instead of hardcoded hex values or arbitrary `zinc` color choices in the landing page refresh.

**Rationale**: The repo-level guidance explicitly forbids hardcoded hex/rgb colors in UI code, and the current landing hero and CTA sections already violate that standard. Moving to semantic tokens preserves the current palette through `globals.css` while making contrast and theming more maintainable.

**Alternatives considered**:
- Keep the current hardcoded hero gradient because it matches the palette. Rejected because it conflicts with project standards and makes future accessibility tuning harder.
- Introduce a new palette for the landing page only. Rejected because the feature spec explicitly requires palette continuity.

## Decision 3: Reframe the page around a clearer narrative sequence instead of repeating generic feature grids

**Decision**: Plan for a narrative flow of hero -> proof/trust signal strip -> differentiated workflow/value section -> capability details -> pricing -> final CTA, with each section owning a distinct message and conversion role.

**Rationale**: The current page already has hero, features, workflow, pricing, and CTA sections, but the copy and pacing are generic and repetitive. A more explicit narrative sequence improves comprehension for first-time visitors and supports the requirement for a more distinctive experience without inventing product capabilities.

**Alternatives considered**:
- Keep the current section order and only restyle it. Rejected because the spec calls for clearer section relationships and stronger uniqueness, not only visual polish.
- Add many more sections. Rejected because more surface area risks redundancy and slower comprehension.

## Decision 4: Use trust signals grounded in existing product facts rather than new customer claims

**Decision**: Represent trust through accurate workflow specificity, visible stages, concrete artifacts like specifications/plans/tasks, and supportable product mechanics already present in the application, instead of fictional logos, testimonials, or unsupported performance claims.

**Rationale**: The spec explicitly forbids unsupported claims. The current product already has real differentiators, including stage-based workflow orchestration, spec artifacts, and preview/deploy workflows, which can be surfaced without creating legal or credibility risk.

**Alternatives considered**:
- Add testimonials or customer metrics. Rejected because no validated source material is available in the repo.
- Remove trust content entirely. Rejected because the spec requires retaining or improving proof points.

## Decision 5: Treat keyboard order, mobile readability, and reduced motion as first-class acceptance criteria

**Decision**: Implementation should preserve a heading-led reading order, keep CTAs reachable by keyboard in visual sequence, and ensure animated surfaces pause or simplify when `prefers-reduced-motion` is enabled.

**Rationale**: Accessibility is an explicit user goal. The current codebase already contains reduced-motion handling for some animated elements, which should be preserved and extended rather than bypassed.

**Alternatives considered**:
- Limit accessibility validation to visual contrast only. Rejected because the feature spec also requires keyboard access and motion sensitivity support.
- Use only unit tests for verification. Rejected because keyboard order and responsive behavior require at least one browser-level check.

## Decision 6: Use one component-level test layer plus one browser-required verification layer

**Decision**: Plan for Vitest component coverage to validate section rendering, headings, and CTA presence, and reserve Playwright for browser-required validation of keyboard traversal, responsive CTA visibility, and reduced-motion-safe behavior.

**Rationale**: This follows the project’s Testing Trophy: default to faster tests, use E2E only where browser behavior is the actual requirement.

**Alternatives considered**:
- Cover everything with Playwright. Rejected because it is slower and unnecessary for most static rendering checks.
- Skip browser tests. Rejected because keyboard order and viewport behavior are explicit acceptance criteria.
