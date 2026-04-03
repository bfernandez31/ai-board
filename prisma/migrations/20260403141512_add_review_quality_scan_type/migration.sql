-- AlterEnum
ALTER TYPE "HealthScanType" ADD VALUE 'REVIEW_QUALITY';

-- AlterTable
ALTER TABLE "HealthScore" ADD COLUMN     "lastReviewQualityScan" TIMESTAMP(3),
ADD COLUMN     "reviewQualityScore" INTEGER;
