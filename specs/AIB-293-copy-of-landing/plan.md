# Implementation Plan: Copy of Landing page

**Branch**: `AIB-293-copy-of-landing` | **Date**: 2026-03-16 | **Spec**: [/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/spec.md](/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/spec.md)
**Input**: Feature specification from `/specs/AIB-293-copy-of-landing/spec.md`

## Summary

Refresh the public landing page with a more distinctive narrative and section rhythm while preserving the existing Catppuccin-based palette, using the current Next.js marketing page composition and semantic Tailwind tokens. The implementation will focus on reorganizing hero, proof, feature, workflow, pricing, and closing CTA content so first-time visitors understand the product faster, keyboard users can traverse all actions predictably, and decorative motion remains optional and non-blocking.

## Technical Context

**Language/Version**: TypeScript 5.6, React 18, Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, TailwindCSS 3.4, shadcn/ui, lucide-react  
**Storage**: N/A for the landing page render; pricing content reads existing static plan data from application code  
**Testing**: Vitest for component coverage, Playwright for browser-required keyboard and viewport verification  
**Target Platform**: Public web landing page rendered by Next.js 16 across modern mobile, tablet, and desktop browsers  
**Project Type**: Web application  
**Performance Goals**: Maintain fast first render for the public homepage, keep above-the-fold content server-rendered, and avoid adding blocking client-only logic to the main narrative sections  
**Constraints**: Preserve existing palette and product truthfulness, use semantic Tailwind tokens instead of hardcoded hex/rgb classes, maintain logical heading/focus order, and respect reduced-motion preferences for decorative animation  
**Scale/Scope**: One public marketing route (`/` via `app/page.tsx` and `app/landing/page.tsx`), plus the landing-specific components and shared header/footer navigation it depends on

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **TypeScript-first**: Pass. The feature stays within the existing strict TypeScript Next.js codebase and does not require exceptions such as `any`.
- **Component-driven architecture**: Pass with one corrective requirement. The landing refresh will keep composition within existing `components/landing/*` and shared layout components, using shadcn/ui primitives where interaction is needed. Research confirms the current landing page violates local project color guidance through hardcoded marketing gradients, so implementation must remove those usages rather than expand them.
- **Test strategy**: Pass. Planned verification uses a Vitest component test for structure/CTA rendering plus a Playwright check only for browser-required keyboard order and responsive navigation behavior.
- **Security-first design**: Pass. No new secrets, auth changes, raw HTML injection, or unsafe client data flows are introduced.
- **Database integrity**: Pass. No schema or persistence changes are required.
- **AI-first development model**: Pass. All generated artifacts remain inside `specs/AIB-293-copy-of-landing/`.

**Post-Phase-1 gate status**: Pass. The design artifacts preserve the existing stack, avoid forbidden dependencies, keep documentation inside the ticket spec directory, and constrain implementation to component and content restructuring on the marketing page.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-293-copy-of-landing/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── landing-page-contract.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── page.tsx
├── landing/
│   ├── page.tsx
│   └── components/
└── layout.tsx

components/
├── landing/
│   ├── hero-section.tsx
│   ├── features-grid.tsx
│   ├── workflow-section.tsx
│   ├── pricing-section.tsx
│   ├── cta-section.tsx
│   ├── feature-card.tsx
│   ├── pricing-card.tsx
│   ├── pricing-faq.tsx
│   ├── workflow-column-card.tsx
│   ├── workflow-step.tsx
│   ├── mini-kanban-demo.tsx
│   └── demo-ticket-card.tsx
├── layout/
│   ├── header.tsx
│   ├── footer.tsx
│   └── mobile-menu.tsx
└── ui/

app/globals.css
tests/
├── unit/
├── unit/components/
└── e2e/
```

**Structure Decision**: Use the existing web-application structure. Implementation stays within `app/page.tsx`, `app/landing/page.tsx`, `components/landing/*`, and shared marketing navigation in `components/layout/*`, with any supporting tests added to the existing Vitest and Playwright directories.

## Phase 0: Research Focus

1. Replace all landing-page hardcoded colors and shadows with semantic tokens or token-backed Tailwind utilities while preserving the current palette.
2. Define a more distinctive section sequence that improves comprehension without inventing unsupported product claims.
3. Decide which interactions require client-side behavior versus server-rendered static content.
4. Determine the minimal browser-required verification needed for focus order, reduced-motion behavior, and responsive CTA visibility.

## Phase 1: Design Focus

1. Model the landing page as a sequence of presentation entities: sections, CTAs, trust signals, proof elements, and motion surfaces.
2. Define a content contract for the public landing page so implementation and review can validate section order, message intent, CTA consistency, and accessibility expectations.
3. Produce a quickstart validation flow covering visual QA, keyboard traversal, reduced-motion checks, and regression boundaries.
4. Update agent context so future implementation runs see the landing page as a semantic-token marketing refresh on the existing Next.js/Tailwind stack.

## Complexity Tracking

No constitution violations or justified exceptions are required for this plan.
