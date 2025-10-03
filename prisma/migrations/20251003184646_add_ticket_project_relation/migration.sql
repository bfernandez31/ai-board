/*
  Warnings:

  - Added the required column `projectId` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Ticket" ADD COLUMN     "projectId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Ticket_projectId_idx" ON "public"."Ticket"("projectId");

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
