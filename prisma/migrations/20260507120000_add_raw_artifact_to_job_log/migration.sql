-- AlterTable
ALTER TABLE "JobLog" ADD COLUMN "rawArtifactKey" VARCHAR(300),
ADD COLUMN "rawArtifactSize" INTEGER;
