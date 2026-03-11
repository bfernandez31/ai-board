# Implementation Plan: Add pricing section to landing page & footer

**Branch**: `AIB-270-add-pricing-section` | **Date**: 2026-03-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/AIB-270-add-pricing-section/spec.md`

## Summary

Design and implement a conversion-focused pricing section on the marketing landing page plus a shared footer that appears on every public marketing route (`/landing`, `/terms`, `/privacy`). The pricing section introduces three plan cards (Free, Pro, Team) with CTA buttons, feature bullets, trial messaging, and a compact FAQ for BYOK + supported agents. Content must be centralized in a single configuration object so marketing can adjust copy without touching multiple components. The shared footer must surface legal + GitHub links, open external destinations in new tabs, and avoid impacting authenticated product routes.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Next.js 16 (App Router), React 18, Node.js 22.20.0  
**Primary Dependencies**: Next.js App Router Server Components, shadcn/ui (Card, Badge, Button, Collapsible), lucide-react icons, TailwindCSS 3.4, centralized analytics instrumentation via `data-analytics-id` attributes defined in `lib/marketing/pricing-content.ts`  
**Storage**: N/A — marketing copy read from static config (`lib/marketing/pricing-content.ts`) and consumed by Server Components  
**Testing**: Vitest component tests for pricing + FAQ rendering, Vitest component/integration tests for footer visibility logic, plus a focused Playwright smoke spec for `/landing` (360px viewport) to verify section order + CTA navigation  
**Target Platform**: Public marketing surfaces rendered via Next.js Server Components (desktop, tablet, mobile ≥320px)  
**Project Type**: Web application (Next.js feature within marketing route group)  
**Performance Goals**: Preserve existing landing page Core Web Vitals (FCP <1.5s, CLS <0.1) while ensuring SC-001 (90% of mobile sessions can view pricing section without horizontal scroll)  
**Constraints**: Must slot between `WorkflowSection` and `CTASection`, reuse Catppuccin dark theme tokens, enforce responsive stacking <360px, CTA + FAQ instrumentation hooks, central config for copy, no forbidden UI libs, minimize JS for marketing surfaces  
**Scale/Scope**: Modifies landing layout + legal pages, introduces marketing config + components, updates shared footer + app layout gating, ensures `/terms` + `/privacy` routes exist outside `/legal` prefix  
**Integrations**:  
- CTA flow into signup + billing upgrade via `/auth/signin?callbackUrl=/settings/billing?plan={PLAN}` (Pro/Team) and `/auth/signin` (Free) so billing UI highlights the selected tier before checkout  
- Footer visibility gating implemented through a dedicated `(marketing)` layout that wraps landing/legal routes while root layout drops the global footer

## Constitution Check (Pre-Design Gate)

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. TypeScript-First** | ✅ PASS | All marketing components typed (props/interfaces), config object typed to prevent `any`. |
| **II. Component-Driven** | ✅ PASS | Pricing + FAQ live under `components/landing/`, rely on shadcn/ui primitives; reuse Server Components unless interactivity (FAQ) needs client Collapsible. |
| **III. Test-Driven** | ✅ PASS | `/ai-board:testing` skill invoked; plan calls for Vitest component tests (pricing card rendering + CTA instrumentation) and layout visibility test for footer gate before implementation. |
| **IV. Security-First** | ✅ PASS | No user input forms; CTA links leverage existing authenticated routes; ensure external links use `rel="noopener noreferrer"`. |
| **V. Database Integrity** | ✅ PASS | No schema changes; marketing content resides in static config. |
| **VI. Clarification Guardrails** | ✅ PASS | Auto-resolved spec decisions documented; unknowns captured as NEEDS CLARIFICATION for research. |
| **VII. AI-First Model** | ✅ PASS | Artifacts live under `specs/AIB-270-add-pricing-section/`; no human-only docs at repo root. |

**Overall Gate**: ✅ **PROCEED TO PHASE 0** — all constitutional requirements satisfied pending research on instrumentation + layout integrations.

## Project Structure

### Documentation (feature scope)

```
specs/AIB-270-add-pricing-section/
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 findings (NEEDS CLARIFICATION resolutions + best practices)
├── data-model.md        # Phase 1 entity definitions (PricingPlan, FAQEntry, FooterLink)
├── quickstart.md        # Phase 1 developer checklist + test entry points
├── contracts/
│   └── marketing-public.yaml  # OpenAPI contract for marketing routes + CTA targets
├── checklists/
│   └── requirements.md  # Provided readiness checklist
└── tasks.md             # Phase 2 task breakdown (generated later)
```

### Source Code (repository root)

```
app/
├── layout.tsx                       # [MODIFY] Remove unconditional Footer, keep shared providers only
├── (marketing)/                     # [CREATE GROUP] Marketing-only layout wrapper with header + new footer
│   ├── layout.tsx                   # [CREATE] Inject marketing header/footer + Theme background
│   ├── landing/page.tsx             # [MODIFY] Insert PricingSection + FAQ before CTA
│   ├── terms/page.tsx               # [MOVE/RE-EXPORT] Former app/legal/terms content → /terms
│   └── privacy/page.tsx             # [MOVE/RE-EXPORT] Former app/legal/privacy content → /privacy
└── legal/                           # [DEPRECATE] Replace with redirects or thin wrappers if kept for backwards compatibility

components/
├── landing/
│   ├── pricing-section.tsx          # [CREATE] Server component orchestrating plan cards + FAQ container
│   ├── pricing-card.tsx             # [CREATE] Card component with CTA, badges, feature bullets, instrumentation hooks
│   ├── faq.tsx                      # [CREATE] BYOK/support accordion using shadcn Collapsible
│   └── plan-feature-list.tsx        # [OPTIONAL REUSE] Subcomponent for bullet lists + check icons
└── layout/
    └── footer.tsx                   # [MODIFY] Consume centralized config, add GitHub link, new-tab handling, instrumentation attributes

lib/
└── marketing/
    └── pricing-content.ts           # [CREATE] Single config exporting pricing plans, FAQ entries, footer links, analytics IDs

hooks/
└── use-marketing-route.ts           # [CREATE] Client hook for determining if current route is marketing (if gating needed outside layout)

tests/
├── unit/components/
│   └── landing/pricing-section.test.tsx   # [CREATE] Snapshot + CTA instrumentation tests (Vitest + RTL)
├── unit/components/layout/footer.test.tsx # [UPDATE/CREATE] Ensure footer renders correct links + visibility gating props
└── e2e/
    └── marketing-pricing.spec.ts         # [OPTIONAL if required] Responsive Playwright smoke verifying CTA flows
```

**Structure Decision**: Adopt a dedicated `(marketing)` route group so landing + legal pages share a marketing layout with footer while protecting authenticated dashboards. Content config lives under `lib/marketing/` for reuse across components and potential future marketing pages. Tests follow Testing Trophy: component tests for rendering/instrumentation, optional E2E only if Phase 0 research deems it necessary for SC-001.

## Implementation Approach (Phases)

### Phase 0 – Research & Clarifications
1. Resolve CTA deep-link target (confirm `/auth/signin?callbackUrl=/settings/billing?plan=PRO|TEAM` or alternative) and document fallback if billing page must auto-start checkout.
2. Determine best practice for marketing-only layout gating vs. client-side checks; validate impact on authenticated routes and existing `Header` logic.
3. Capture shadcn/ui + Next.js responsive patterns for cards/FAQ and instrumentation data attributes per FR-009.  
*Output*: `research.md` with Decision/Rationale/Alternatives for each unknown + dependency best practice.

### Phase 1 – Design & Contracts
1. **Data modeling**: Define `PricingPlanContent`, `FAQEntry`, `FooterLink` interfaces + validation notes in `data-model.md`; ensure config supports analytics IDs + CTA metadata.
2. **Component design**: Document component responsibilities, props, and server/client boundaries in plan + quickstart. Produce OpenAPI contract for marketing routes (GET `/landing`, `/terms`, `/privacy`) describing expected sections + instrumentation requirements.
3. **Footer strategy**: Plan layout refactor (root vs. marketing layout) and note state handling for header/footers to avoid double rendering in authenticated shell.
4. **Agent context**: Run update-agent-context script after documenting new technologies/patterns.

### Phase 2 (preview for /speckit.tasks)
- Break down implementation tasks (config creation, component scaffolding, layout refactor, tests, analytics instrumentation) once plan approved.

## Testing Strategy (from /ai-board:testing skill)
- **Component tests** (Vitest + RTL):
  - Pricing section renders 3 plans with correct CTA labels + data attributes.
  - FAQ accordion toggles content and exposes tracking IDs.
  - Footer renders Terms/Privacy/GitHub links, enforces `target="_blank"` for external links.
- **Integration/component tests**: Validate marketing layout gating—render marketing + authenticated routes to ensure footer hidden where required.
- **E2E (conditional)**: If Phase 0 finds no existing responsive coverage, add Playwright smoke verifying landing page adds pricing section between Workflow + CTA and that CTAs navigate correctly when unauthenticated.
- **Test discovery**: Search `tests/**/*landing*` and `tests/**/*footer*` before creating new files to extend existing suites when possible.

## Phase 0 Research Focus Areas (Completed)
1. **CTA deep-link contract**: ✅ See `research.md` §1 for callbackUrl + billing highlight plan.
2. **Marketing layout gating**: ✅ Route-group approach documented in §2.
3. **Analytics instrumentation best practices**: ✅ `data-analytics-id` naming pattern defined in §3.
4. **shadcn/ui responsive cards**: ✅ Layout + Collapsible patterns captured in §4.
5. **Testing surface**: ✅ Coverage split (Vitest + Playwright smoke) decided in §5.

## Complexity Tracking

No constitution exceptions anticipated. Feature lives entirely within existing Next.js marketing stack; complexity stems from marketing layout refactor plus centralized config, both within standard patterns.

## Post-Design Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. TypeScript-First** | ✅ PASS | Data model defines typed interfaces for `MarketingContent`, `PricingPlanContent`, etc.; quickstart instructs maintaining strict typing across config + components. |
| **II. Component-Driven** | ✅ PASS | Plan specifies `components/landing/*` Server Components, shadcn `Card` usage, marketing layout route group for shared footer. |
| **III. Test-Driven** | ✅ PASS | Research + quickstart outline Vitest suites plus minimal Playwright smoke; `/ai-board:testing` skill consulted before planning coverage. |
| **IV. Security-First** | ✅ PASS | Footer links enforce `target="_blank"` + `rel="noopener noreferrer"`, CTA URLs route through authenticated flows without exposing new endpoints. |
| **V. Database Integrity** | ✅ PASS | No schema changes; marketing content remains static config, ensuring DB untouched. |
| **VI. Clarification Guardrails** | ✅ PASS | All `NEEDS CLARIFICATION` markers resolved in `research.md`; plan documents decisions + alternatives. |
| **VII. AI-First Model** | ✅ PASS | Deliverables confined to `specs/AIB-270-add-pricing-section/` plus referenced source paths; no human tutorials added. |

**Ready for Phase 2 task breakdown.**
