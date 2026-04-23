/*
  Warnings:

  - You are about to drop the column `logs` on the `Job` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('NONE', 'AVAILABLE', 'PRUNED');

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "logs",
ADD COLUMN     "logStatus" "LogStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "logSummary" TEXT;

-- CreateTable
CREATE TABLE "JobLog" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "agentType" VARCHAR(20) NOT NULL,
    "rawContent" TEXT NOT NULL,
    "entries" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "rawSize" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobLog_jobId_key" ON "JobLog"("jobId");

-- CreateIndex
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");

-- CreateIndex
CREATE INDEX "JobLog_createdAt_idx" ON "JobLog"("createdAt");

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
