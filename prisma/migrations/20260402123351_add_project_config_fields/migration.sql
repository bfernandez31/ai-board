-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "config" JSONB,
ADD COLUMN     "configSyncedAt" TIMESTAMP(3);
