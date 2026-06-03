-- CreateEnum
CREATE TYPE "TokenSavingOverride" AS ENUM ('FORCE_ON', 'FORCE_OFF');

-- CreateEnum
CREATE TYPE "TokenSavingRunStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FALLBACK', 'NOT_APPLICABLE', 'NOT_RECORDED');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "tokenSavingFallbackReason" VARCHAR(1000),
ADD COLUMN     "tokenSavingRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tokenSavingStatus" "TokenSavingRunStatus" NOT NULL DEFAULT 'NOT_RECORDED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "tokenSavingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "tokenSavingOverride" "TokenSavingOverride";
