# Quick Implementation: Ticket Comparison Dashboard

**Feature Branch**: `AIB-327-ticket-comparison-dashboard`
**Created**: 2026-03-20
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Visual comparison view with DB storage for ticket comparisons. When `/compare` runs, it saves structured comparison data to the database via API. A rich visual dashboard replaces the raw markdown experience, showing rankings, metrics, decision points, and constitution compliance.

## Changes

### Database
- `TicketComparison` model: stores comparison metadata (source ticket, recommendation, winner)
- `ComparisonEntry` model: per-ticket data (rank, score, code metrics, compliance, decision points)

### API Endpoints
- `POST /api/projects/:projectId/comparisons/stored` - Save comparison data (workflow auth)
- `GET /api/projects/:projectId/comparisons/stored` - List stored comparisons (session auth)
- `GET /api/projects/:projectId/comparisons/stored/:id` - Get enriched comparison detail

### UI Components
- `ComparisonDashboard` - Visual comparison view with ranking, metrics, decision points, compliance grid
- Updated `ComparisonViewer` - Supports both dashboard (stored) and report (markdown) views
- Updated ticket detail modal to show Compare button for both file-based and stored comparisons

### Compare Command
- Added Step 11 to save structured data via API after generating markdown report
