# Tasks: Personal Access Tokens for API Authentication

**Input**: Design documents from `/specs/AIB-184-personal-access-tokens/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/pat-api.yaml ✅

**Tests**: Not explicitly requested in the feature specification. Tests will be added in Polish phase if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and core token utilities

- [x] T001 Add PersonalAccessToken model to prisma/schema.prisma with userId relation
- [x] T002 Add personalAccessTokens relation to User model in prisma/schema.prisma
- [x] T003 Run Prisma migration: `bunx prisma migrate dev --name add-personal-access-tokens`
- [x] T004 [P] Create token utilities in lib/auth/token-utils.ts (generateToken, getTokenLookup, getTokenPreview, hashToken, verifyToken, isValidTokenFormat)
- [x] T005 [P] Create Zod validation schema in lib/validations/token.ts (createTokenSchema)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database operations layer that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create token database operations in lib/db/tokens.ts (listTokens, createToken, revokeToken, validateToken functions)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Generate a New Personal Access Token (Priority: P1) 🎯 MVP

**Goal**: Allow users to generate new PATs with a user-provided name, display the full token once, enforce max 10 tokens per user

**Independent Test**: Navigate to token settings, enter a name, generate a token, verify the token is displayed once and can be copied

### Implementation for User Story 1

- [x] T007 [P] [US1] Create POST /api/tokens endpoint in app/api/tokens/route.ts
- [x] T008 [P] [US1] Create CreateTokenDialog component in components/settings/create-token-dialog.tsx (name input, token display with copy button, warning about one-time display)
- [x] T009 [US1] Create token settings page at app/settings/tokens/page.tsx with heading and description
- [x] T010 [US1] Create TokenListCard component in components/settings/token-list-card.tsx with "Generate new token" button that opens CreateTokenDialog

**Checkpoint**: User Story 1 complete - users can generate tokens and copy them

---

## Phase 4: User Story 2 - Authenticate API Requests with PAT (Priority: P1) 🎯 MVP

**Goal**: Enable external tools to authenticate API requests using Bearer token header

**Independent Test**: Make an API request with `Authorization: Bearer pat_xxx` header and verify access is granted with correct user context

### Implementation for User Story 2

- [x] T011 [US2] Create token auth helper in lib/auth/token-auth.ts (getUserIdFromBearerToken function)
- [x] T012 [US2] Integrate Bearer token auth into existing auth system - modify lib/db/users.ts to check Bearer token before session auth in API routes
- [x] T013 [US2] Update API routes to support token-based authentication via headers (test with an existing endpoint)

**Checkpoint**: User Story 2 complete - external tools can authenticate with PATs

---

## Phase 5: User Story 3 - View and Manage Existing Tokens (Priority: P2)

**Goal**: Display list of all user tokens with name, preview, created date, and last used date

**Independent Test**: Navigate to token settings and verify list displays all tokens with correct information and empty state

### Implementation for User Story 3

- [x] T014 [US3] Create GET /api/tokens endpoint in app/api/tokens/route.ts (list all user tokens)
- [x] T015 [US3] Update TokenListCard in components/settings/token-list-card.tsx to fetch and display token list (name, tokenPreview, createdAt, lastUsedAt) with empty state

**Checkpoint**: User Story 3 complete - users can view all their tokens and usage info

---

## Phase 6: User Story 4 - Delete (Revoke) a Token (Priority: P2)

**Goal**: Allow users to revoke tokens with confirmation, immediately stopping API access

**Independent Test**: Delete a token, confirm it disappears from the list, verify subsequent API requests with that token fail

### Implementation for User Story 4

- [x] T016 [P] [US4] Create DELETE /api/tokens/[id] endpoint in app/api/tokens/[id]/route.ts
- [x] T017 [P] [US4] Create RevokeTokenDialog component in components/settings/revoke-token-dialog.tsx (AlertDialog with token name, irreversible warning, confirm/cancel)
- [x] T018 [US4] Integrate RevokeTokenDialog into TokenListCard with delete button per token

**Checkpoint**: User Story 4 complete - users can revoke tokens with immediate effect

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, error handling, and final integration

- [x] T019 Verify all acceptance scenarios from spec.md work end-to-end
- [x] T020 Run type-check and lint, fix any errors
- [x] T021 Test edge cases: max token limit (10), empty name validation, invalid token format, concurrent requests
- [x] T022 Validate token validation adds <150ms overhead (SC-002 performance goal)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority and core MVP
  - US3 and US4 are P2 priority and can be done after MVP
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - Builds on US1 UI components
- **User Story 4 (P2)**: Can start after Foundational - Builds on US3 token list

### Within Each User Story

- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T004 and T005 (Setup phase) can run in parallel
- T007 and T008 (US1) can run in parallel
- T016 and T017 (US4) can run in parallel
- Once Foundational phase completes, US1 and US2 can run in parallel
- Once US1 is complete, US3 can start; once US3 is complete, US4 can start

---

## Parallel Example: User Story 1

```bash
# After Phase 2 (Foundational) is complete:

# Launch parallel tasks for US1:
Task: "Create POST /api/tokens endpoint in app/api/tokens/route.ts"
Task: "Create CreateTokenDialog component in components/settings/create-token-dialog.tsx"

# Then sequential:
Task: "Create token settings page at app/settings/tokens/page.tsx"
Task: "Create TokenListCard component with Generate new token button"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (schema + utilities)
2. Complete Phase 2: Foundational (db operations)
3. Complete Phase 3: User Story 1 (token generation)
4. Complete Phase 4: User Story 2 (API authentication)
5. **STOP and VALIDATE**: Test token creation and API auth independently
6. Deploy/demo if ready - external tools can now authenticate!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + 2 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 3 → Test independently → Deploy/Demo (token list visibility)
4. Add User Story 4 → Test independently → Deploy/Demo (revocation capability)
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 together form the MVP - both are P1 priority
- Token is displayed once on creation (FR-002), never retrievable again
- Token validation uses two-tier hashing: SHA-256 for lookup, bcrypt for verification
- Max 10 tokens per user enforced at API level (FR-012)
- Generic 401 for all auth failures (security best practice)
- No caching - database lookup every request for immediate revocation
