-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "avgContextTokens" INTEGER,
ADD COLUMN     "peakContextTokens" INTEGER,
ADD COLUMN     "turnCount" INTEGER;
