-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "averageContextSize" INTEGER,
ADD COLUMN     "peakContextSize" INTEGER,
ADD COLUMN     "turnCount" INTEGER;
