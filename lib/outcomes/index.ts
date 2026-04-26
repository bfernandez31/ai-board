export { captureOutcomeForTicket } from './capture';
export { backfillProjectOutcomes } from './backfill';
export { buildOutcome } from './compute';
export { computeJobSignals, classifyJob } from './jobs';
export {
  computeSemanticTags,
  extractStructuralDomains,
  TAG_DB_SCHEMA,
  TAG_TESTS,
  TAG_CI,
} from './domain';
export type {
  ComputedOutcome,
  DiffStats,
  FileChange,
  JobSignals,
} from './types';
export { FRICTION_FREE_QUALITY_THRESHOLD } from './types';
