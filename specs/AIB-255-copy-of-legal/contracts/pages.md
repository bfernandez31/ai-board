# API Contracts: Legal Pages

**Branch**: `AIB-255-copy-of-legal` | **Date**: 2026-03-11

## Overview

This feature introduces no new API endpoints. All legal pages are static Server Components rendered by Next.js App Router. The "contracts" here define the page routes and their expected behavior.

## Page Routes

### GET /legal/terms

- **Authentication**: None required (public)
- **Response**: HTML page (Server Component)
- **Status**: 200 OK
- **Content Requirements**:
  - Page title: "Terms of Service"
  - Effective date displayed
  - Sections: Conditions of Use, Limitation of Liability, BYOK API Cost Responsibility, AI-Generated Code Responsibility
  - Responsive layout (mobile, tablet, desktop)

### GET /legal/privacy

- **Authentication**: None required (public)
- **Response**: HTML page (Server Component)
- **Status**: 200 OK
- **Content Requirements**:
  - Page title: "Privacy Policy"
  - Effective date displayed
  - Sections: Data Collected, Cookies Used, No Data Resale, GDPR Rights
  - Responsive layout (mobile, tablet, desktop)

## Component Contracts

### Footer Component

- **Location**: Rendered in root layout on every page
- **Links**:
  - "Terms of Service" -> `/legal/terms`
  - "Privacy Policy" -> `/legal/privacy`
- **Behavior**: Always visible at page bottom, responsive

### Sign-In Consent Notice

- **Location**: `/auth/signin` page, below OAuth buttons
- **Text**: "By signing in, you agree to our Terms of Service and Privacy Policy"
- **Links**:
  - "Terms of Service" -> `/legal/terms`
  - "Privacy Policy" -> `/legal/privacy`
- **Behavior**: Visible before any sign-in action
