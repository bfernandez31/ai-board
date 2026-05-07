-- AlterTable
ALTER TABLE "JobLog" ADD COLUMN "nativeArtifactKey" VARCHAR(300),
                    ADD COLUMN "nativeArtifactSize" INTEGER;
