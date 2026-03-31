-- Remove clean workflow fields

-- Step 1: Clear any existing cleanup locks
UPDATE "Project" SET "activeCleanupJobId" = NULL WHERE "activeCleanupJobId" IS NOT NULL;

-- Step 2: Drop the column and index
DROP INDEX IF EXISTS "Project_activeCleanupJobId_idx";
ALTER TABLE "Project" DROP COLUMN "activeCleanupJobId";

-- Step 3: Remove Last Clean fields from HealthScore
ALTER TABLE "HealthScore" DROP COLUMN IF EXISTS "lastCleanDate";
ALTER TABLE "HealthScore" DROP COLUMN IF EXISTS "lastCleanJobId";
