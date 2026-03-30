# Quick Implementation: [Spec Sync] technical/api/endpoints

**Feature Branch**: `AIB-395-spec-sync-technical`
**Created**: 2026-03-30
**Mode**: Quick Implementation (bypassing formal specification)

## Description

[Spec Sync] technical/api/endpoints

## Description

Health scan detected spec drift: `POST /api/projects/:projectId/docs` endpoint exists in code at `app/api/projects/[projectId]/docs/route.ts` but was not documented in `specs/specifications/technical/api/endpoints.md`.

## Implementation

Added the missing `POST /api/projects/:projectId/docs` endpoint documentation to the Documentation Endpoints section of the endpoints spec, including request/response schemas, stage-based permission rules, markdown validation, and error codes.
