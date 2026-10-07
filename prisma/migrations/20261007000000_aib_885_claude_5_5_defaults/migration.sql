-- AIB-885: promote Claude 5.5 models to the project default.
-- Projects AND tickets still pinned to the PREVIOUS Claude smart-defaults
-- (specify/plan = Opus 4.8, implement/quick-impl/verify = Sonnet 4.6) are
-- upgraded in place so 5.5 becomes the default. Each UPDATE is scoped to the
-- exact (stage column, previous-smart-default model) pair, so deliberate
-- per-stage pins that were never smart defaults (e.g. a verifyModel manually
-- set to Opus 4.8, or a specifyModel set to Sonnet 4.6) are left untouched.
-- The old 4.x ids remain valid in CLAUDE_MODEL_IDS.

UPDATE "Project" SET "specifyModel"   = 'claude-opus-5-5'   WHERE "specifyModel"   = 'claude-opus-4-8';
UPDATE "Project" SET "planModel"      = 'claude-opus-5-5'   WHERE "planModel"      = 'claude-opus-4-8';
UPDATE "Project" SET "implementModel" = 'claude-sonnet-5-5' WHERE "implementModel" = 'claude-sonnet-4-6';
UPDATE "Project" SET "quickImplModel" = 'claude-sonnet-5-5' WHERE "quickImplModel" = 'claude-sonnet-4-6';
UPDATE "Project" SET "verifyModel"    = 'claude-sonnet-5-5' WHERE "verifyModel"    = 'claude-sonnet-4-6';

UPDATE "Ticket" SET "specifyModel"   = 'claude-opus-5-5'   WHERE "specifyModel"   = 'claude-opus-4-8';
UPDATE "Ticket" SET "planModel"      = 'claude-opus-5-5'   WHERE "planModel"      = 'claude-opus-4-8';
UPDATE "Ticket" SET "implementModel" = 'claude-sonnet-5-5' WHERE "implementModel" = 'claude-sonnet-4-6';
UPDATE "Ticket" SET "quickImplModel" = 'claude-sonnet-5-5' WHERE "quickImplModel" = 'claude-sonnet-4-6';
UPDATE "Ticket" SET "verifyModel"    = 'claude-sonnet-5-5' WHERE "verifyModel"    = 'claude-sonnet-4-6';
