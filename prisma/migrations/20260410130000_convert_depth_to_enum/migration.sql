-- CreateEnum
CREATE TYPE "SetupJobDepth" AS ENUM ('QUICK', 'STANDARD', 'COMPREHENSIVE');

-- Convert depth column from VARCHAR(20) to SetupJobDepth enum
ALTER TABLE "ProjectSetupJob" ALTER COLUMN "depth" TYPE "SetupJobDepth" USING "depth"::"SetupJobDepth";
