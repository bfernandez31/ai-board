# Quickstart: Copy of Landing page

## Goal

Validate the landing page refresh against message clarity, distinctiveness, accessibility, and regression boundaries before implementation is considered complete.

## Prerequisites

- Install dependencies with `bun install`
- Run the app locally with `bun run dev`
- Open the unauthenticated homepage at `http://localhost:3000/`

## Implementation Checklist

1. Keep the landing page rooted at `/` through `app/page.tsx` and `app/landing/page.tsx`.
2. Restrict edits to landing and shared marketing layout components unless a supporting utility is clearly required.
3. Replace landing-page hardcoded colors with semantic Tailwind tokens or token-backed classes.
4. Preserve supported claims only; do not introduce testimonials, customer counts, or features not represented in the product.
5. Keep decorative motion optional and reduced-motion safe.
6. Preserve section order as `hero -> proof -> workflow -> capabilities -> pricing -> final-cta`.
7. Keep the primary CTA label as `Get Started Free` wherever it points to `/auth/signin`.
8. Keep the secondary workflow CTA label as `Explore Workflow` wherever it points to `#workflow`.

## Verification Flow

1. Run `bun run type-check`.
2. Run `bun run lint`.
3. Run the targeted Vitest suite for updated landing page components.
4. Run the targeted Playwright coverage for browser-required landing-page behavior.
5. Manually verify the page at mobile, tablet, and desktop widths.
6. Tab through the page from header to final CTA and confirm focus order matches reading order.
7. Enable reduced-motion preference in browser tooling and confirm decorative surfaces become static or simplified without hiding key content.

## Reviewer Expectations

- Header marketing anchors should appear in this order: `Proof`, `Workflow`, `Capabilities`, `Pricing`, then the primary auth CTA.
- The hero and final CTA should reinforce the same next step instead of introducing a different conversion label.
- The proof section should focus on supportable workflow artifacts: specifications, stage progression, and workflow-backed execution.
- The workflow section should explain the staged process in plain language and remain readable without relying on animation.
- The page should avoid horizontal scrolling from mobile through desktop widths.

## Review Prompts

- Can a first-time visitor describe what AI Board does after reading the hero and first supporting section?
- Does each section add a new idea rather than restating earlier copy?
- Are the main CTA labels consistent from hero to closing section?
- Does the page feel more specific and memorable without changing the product’s palette?
- Are all headings, controls, and proof elements readable at a WCAG-friendly contrast level?
