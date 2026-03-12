# Contract: Landing Page Pricing and Navigation

**Feature**: `AIB-278-add-pricing-section`  
**Branch**: `AIB-278-add-pricing-section`  
**Date**: 2026-03-12

## Overview

This feature introduces no new server API endpoints. The contract here defines the expected behavior for the existing landing page route, pricing CTAs, and the in-page pricing anchor exposed from header and footer navigation.

## Route Contract

### GET /

- **Authentication**: Public when the visitor is not authenticated
- **Response**: Server-rendered landing page HTML
- **Pricing Requirements**:
  - A section with `id="pricing"` is present
  - The pricing section renders after the workflow section and before the final CTA section
  - Exactly three plan cards appear: Free, Pro, Team
  - A two-entry FAQ appears directly beneath the plan cards

## CTA Contract

### Free Plan CTA

- **Label**: `Get Started`
- **Destination**: Existing authentication/signup entry point
- **Behavior**: Starts the current free-plan onboarding path without introducing a new route

### Pro Plan CTA

- **Label**: `Start 14-day trial`
- **Destination**: Existing authentication/signup entry point, with implementation free to route into the current paid-plan trial flow
- **Behavior**: Reuses existing trial-capable conversion flow

### Team Plan CTA

- **Label**: `Start 14-day trial`
- **Destination**: Existing authentication/signup entry point, with implementation free to route into the current team-plan trial flow
- **Behavior**: Reuses existing trial-capable conversion flow

## Navigation Contract

### Header Pricing Link

- **Location**: Marketing variant of `/home/runner/work/ai-board/ai-board/target/components/layout/header.tsx`
- **Label**: `Pricing`
- **Href**: `#pricing`
- **Behavior**: Navigates to the pricing section on the landing page

### Footer Pricing Link

- **Location**: `/home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx`
- **Label**: `Pricing`
- **Href**: `#pricing`
- **Behavior**: Navigates to the pricing section without removing or obscuring `Terms of Service` and `Privacy Policy`

## FAQ Contract

The FAQ block must contain exactly two items:

1. A BYOK explanation for plan selection context
2. A supported-agents entry that names Claude and Codex

## Explicit Non-Contracts

- No new REST endpoints
- No GraphQL schema changes
- No Prisma model changes
- No webhook or billing backend contract changes
