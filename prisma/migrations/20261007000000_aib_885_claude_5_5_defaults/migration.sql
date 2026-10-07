-- AIB-885: promote Claude 5.5 models to the project default.
-- Existing projects still pinned to the previous Claude smart-defaults
-- (Opus 4.8 / Sonnet 4.6) are upgraded in place so 5.5 becomes the default
-- for all projects that were on Claude Opus and Sonnet.

UPDATE "Project" SET "specifyModel" = 'claude-opus-5-5' WHERE "specifyModel" = 'claude-opus-4-8';
UPDATE "Project" SET "planModel" = 'claude-opus-5-5' WHERE "planModel" = 'claude-opus-4-8';
UPDATE "Project" SET "implementModel" = 'claude-opus-5-5' WHERE "implementModel" = 'claude-opus-4-8';
UPDATE "Project" SET "quickImplModel" = 'claude-opus-5-5' WHERE "quickImplModel" = 'claude-opus-4-8';
UPDATE "Project" SET "verifyModel" = 'claude-opus-5-5' WHERE "verifyModel" = 'claude-opus-4-8';

UPDATE "Project" SET "specifyModel" = 'claude-sonnet-5-5' WHERE "specifyModel" = 'claude-sonnet-4-6';
UPDATE "Project" SET "planModel" = 'claude-sonnet-5-5' WHERE "planModel" = 'claude-sonnet-4-6';
UPDATE "Project" SET "implementModel" = 'claude-sonnet-5-5' WHERE "implementModel" = 'claude-sonnet-4-6';
UPDATE "Project" SET "quickImplModel" = 'claude-sonnet-5-5' WHERE "quickImplModel" = 'claude-sonnet-4-6';
UPDATE "Project" SET "verifyModel" = 'claude-sonnet-5-5' WHERE "verifyModel" = 'claude-sonnet-4-6';
