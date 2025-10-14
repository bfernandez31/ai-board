/*
  Warnings:

  - Added the required column `projectId` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "projectId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Job_projectId_idx" ON "Job"("projectId");
