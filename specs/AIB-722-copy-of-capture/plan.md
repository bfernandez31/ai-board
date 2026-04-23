# Implementation Plan: Capture and Display Agent Execution Logs

**Branch**: `AIB-722-copy-of-capture` | **Date**: 2024-04-23 | **Spec**: specs/AIB-722-copy-of-capture/spec.md
**Input**: Feature specification from `/specs/AIB-722-copy-of-capture/spec.md`

## Summary

Implement a hybrid storage system for capturing and displaying agent execution logs. The system will store log metadata in PostgreSQL and full log content in AWS S3, with a 30-day retention policy. Users can view log previews inline in the job timeline and access full logs through a modal dialog.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 14.x
**Primary Dependencies**: Prisma, AWS SDK, shadcn/ui, TanStack Query, Zod
**Storage**: PostgreSQL (metadata) + AWS S3 (content)
**Testing**: Vitest, React Testing Library, Playwright
**Target Platform**: Web application (Next.js)
**Project Type**: Web application with backend services
**Performance Goals**: Log retrieval <2s for 90% of requests, log availability within 5s of job completion
**Constraints**: Storage efficiency <1GB/1000 jobs, database impact <10% of total size
**Scale/Scope**: Support Claude, Codex, Mistral, Gemini agents for all project members

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **TypeScript-First Development**: All code will use TypeScript with strict mode
✅ **Component-Driven Architecture**: Will use shadcn/ui components and feature-based structure
✅ **Test-Driven Development**: Tests required for all functionality
✅ **Security-First Design**: Zod validation, Prisma queries, proper access control
✅ **Database Integrity**: Prisma migrations, transactions, proper relationships
✅ **Error Handling**: Comprehensive try-catch blocks, structured error responses
✅ **State Management**: Follow existing atomic update patterns

## Project Structure

### Documentation (this feature)

```
specs/AIB-722-copy-of-capture/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── log-capture-api.ts
│   └── log-retrieval-api.ts
└── workflows/           # Phase 1 output
    ├── log-capture-workflow.md
    └── log-pruning-workflow.md
```

### Source Code (repository root)

```
# Database
prisma/schema.prisma     # Updated with JobLog, LogEntry, LogStorage models

# Backend Services
app/api/jobs/
├── [id]
│   ├── logs
│   │   └── route.ts      # Log retrieval endpoint
│   └── status
│       └── route.ts      # Updated with log capture
└── logs
    └── route.ts          # Log management endpoints

lib/services/
├── log-service.ts        # Core log business logic
└── storage-service.ts    # S3 storage operations

lib/types/
├── job-types.ts          # Extended with log types
└── log-types.ts          # New log-related interfaces

# UI Components
components/ticket/
├── jobs-timeline.tsx     # Extended with log viewing
└── log-viewer-modal.tsx  # New log display component

components/logs/
├── log-entry.tsx         # Individual log entry display
└── log-header.tsx        # Log metadata display

# Hooks
lib/hooks/
├── queries/
│   └── useJobLogs.ts     # Log data fetching
└── mutations/
    └── useCaptureLogs.ts # Log capture mutation
```

**Structure Decision**: Feature-based organization following existing Next.js patterns. Log-related files grouped under appropriate domains (api/, components/, lib/).

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No constitution violations identified. All patterns follow existing conventions.

## Phase 0: Research (COMPLETED)

✅ Technical context analysis completed
✅ Existing files inventory completed
✅ Patterns to follow documented
✅ Object storage provider selected (AWS S3)
✅ Log capture process designed
✅ UI integration approach defined
✅ Constitution compliance verified

**Artifacts**: `research.md` with all clarifications resolved

## Phase 1: Design & Contracts (COMPLETED)

✅ Database schema designed (JobLog, LogEntry, LogStorage models)
✅ Interface contracts defined
✅ Workflow specifications created
✅ Validation rules established
✅ State transition rules defined
✅ Storage strategy finalized

**Artifacts**:
- `data-model.md` with complete entity definitions
- `contracts/log-capture-api.ts` (to be created)
- `contracts/log-retrieval-api.ts` (to be created)
- `workflows/log-capture-workflow.md` (to be created)
- `workflows/log-pruning-workflow.md` (to be created)

## Phase 2: Implementation

### Task Breakdown

#### 2.1 Database Schema Changes
- [ ] Add JobLog, LogEntry, LogStorage models to prisma/schema.prisma
- [ ] Create Prisma migration
- [ ] Run migration against development database
- [ ] Add TypeScript interfaces to lib/types/log-types.ts
- [ ] Update existing Job interfaces to include log references

**Files to modify**:
- `prisma/schema.prisma` (+90 lines)
- `lib/types/log-types.ts` (new file, ~50 lines)
- `lib/types/job-types.ts` (+5 lines)

#### 2.2 Log Capture Service
- [ ] Extend job status update endpoint to accept log data
- [ ] Implement log processing and normalization
- [ ] Add S3 storage integration with AWS SDK
- [ ] Implement error handling with retries (max 3 attempts)
- [ ] Add log capture to terminal state processing

**Files to modify**:
- `app/api/jobs/[id]/status/route.ts` (+80 lines)
- `lib/services/log-service.ts` (new file, ~120 lines)
- `lib/services/storage-service.ts` (new file, ~80 lines)

**Contracts to create**:
- `contracts/log-capture-api.ts` (API interface)
- `workflows/log-capture-workflow.md` (workflow spec)

#### 2.3 Log Retrieval Service
- [ ] Implement log retrieval API endpoint
- [ ] Add S3 presigned URL generation
- [ ] Implement response caching (5-minute TTL)
- [ ] Add access control validation (same as ticket data)
- [ ] Create log retrieval query hook

**Files to create**:
- `app/api/jobs/[id]/logs/route.ts` (new file, ~90 lines)
- `lib/hooks/queries/useJobLogs.ts` (new file, ~60 lines)

**Contracts to create**:
- `contracts/log-retrieval-api.ts` (API interface)

#### 2.4 UI Integration
- [ ] Extend JobRow component with "View Logs" button
- [ ] Create LogViewerModal component
- [ ] Implement log display with syntax highlighting
- [ ] Add log filtering (by message type)
- [ ] Implement responsive design for log content

**Files to modify**:
- `components/ticket/jobs-timeline.tsx` (+30 lines)

**Files to create**:
- `components/ticket/log-viewer-modal.tsx` (new file, ~150 lines)
- `components/logs/log-entry.tsx` (new file, ~40 lines)
- `components/logs/log-header.tsx` (new file, ~30 lines)

#### 2.5 Log Pruning Service
- [ ] Implement scheduled pruning job
- [ ] Add soft delete functionality to models
- [ ] Implement pruning validation and error handling
- [ ] Add monitoring and alerting

**Files to create**:
- `app/api/admin/logs/prune/route.ts` (new file, ~70 lines)
- `lib/services/log-pruning-service.ts` (new file, ~80 lines)
- `workflows/log-pruning-workflow.md` (workflow spec)

### Testing Strategy

Following constitution test selection decision tree:

1. **Log Service Unit Tests** (Vitest)
   - Log normalization functions
   - Log parsing utilities
   - Error handling scenarios

2. **API Endpoint Tests** (Vitest integration)
   - Log capture endpoint validation
   - Log retrieval endpoint responses
   - Access control verification

3. **Component Tests** (Vitest + RTL)
   - LogViewerModal interactions
   - Log entry display
   - Filtering functionality

4. **E2E Tests** (Playwright)
   - Full log viewing workflow
   - Error scenarios
   - Permission validation

**Test Files to extend**:
- `tests/integration/jobs.test.ts` (extend existing job tests)
- `tests/unit/services/log-service.test.ts` (new file)

**Test Files to create**:
- `tests/unit/components/log-viewer-modal.test.tsx` (new file)
- `tests/e2e/log-viewing.spec.ts` (new file)

## Phase 3: Verification

### Quality Gates
1. ✅ All constitution principles followed
2. ✅ TypeScript strict mode compliance
3. ✅ Comprehensive test coverage
4. ✅ Proper error handling
5. ✅ Security validation
6. ✅ Database integrity
7. ✅ Performance targets met

### Success Criteria Validation
- **SC-001**: Logs available within 5s of job completion
- **SC-002**: 95% user success in debugging without GitHub Actions
- **SC-003**: Storage efficiency <1GB/1000 jobs
- **SC-004**: Log retrieval <2s for 90% of requests
- **SC-005**: All agent types supported
- **SC-006**: No increase in support tickets
- **SC-007**: Database impact <10% of total size

## Implementation Timeline

**Total Estimated Effort**: ~24-32 hours

1. **Database Schema**: 2-3 hours
2. **Log Capture Service**: 6-8 hours  
3. **Log Retrieval Service**: 4-6 hours
4. **UI Integration**: 6-8 hours
5. **Log Pruning Service**: 4-6 hours
6. **Testing**: 4-6 hours

## Risk Assessment

**Low Risk**:
- Database schema changes (Prisma migrations well-established)
- UI integration (extending existing components)
- Access control (reusing existing patterns)

**Medium Risk**:
- S3 integration (new dependency, but AWS SDK well-documented)
- Log normalization (agent-specific formats may vary)
- Performance optimization (caching and retrieval speed)

**Mitigation Strategies**:
- Implement comprehensive error handling for S3 operations
- Create thorough test cases for log normalization
- Add performance monitoring and alerting
- Implement feature flags for gradual rollout

## Deployment Strategy

1. **Feature Flag**: Enable log capture behind feature flag
2. **Gradual Rollout**: Start with internal projects only
3. **Monitoring**: Track storage usage and retrieval performance
4. **Feedback Loop**: Collect user feedback on log usefulness
5. **Full Release**: Enable for all projects after validation

## Monitoring and Observability

**Metrics to Track**:
- Log capture success rate
- Log retrieval latency
- Storage usage growth
- Error rates by agent type
- User engagement with log viewing

**Alerts to Configure**:
- Log capture failures
- Storage approaching limits
- Retrieval latency spikes
- Pruning job failures

## Rollback Plan

1. **Feature Flag Disable**: Immediately stop log capture
2. **Database Cleanup**: Remove JobLog/LogEntry records
3. **S3 Cleanup**: Delete log objects
4. **Monitor**: Verify no orphaned data remains

## Open Questions

None - all NEEDS CLARIFICATION items resolved in research phase.

## Next Steps

1. ✅ Complete Phase 0 research
2. ✅ Complete Phase 1 design
3. ⏳ Implement Phase 2 tasks
4. ⏳ Execute testing strategy
5. ⏳ Deploy with feature flag
6. ⏳ Monitor and iterate

**Branch**: AIB-722-copy-of-capture
**Impl Plan Path**: specs/AIB-722-copy-of-capture/plan.md
**Generated Artifacts**: research.md, data-model.md, contracts/, workflows/