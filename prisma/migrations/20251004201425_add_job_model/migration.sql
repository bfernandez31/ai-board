-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Job" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "command" VARCHAR(50) NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "branch" VARCHAR(200),
    "commitSha" VARCHAR(40),
    "logs" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_ticketId_idx" ON "public"."Job"("ticketId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "public"."Job"("status");

-- CreateIndex
CREATE INDEX "Job_startedAt_idx" ON "public"."Job"("startedAt");

-- CreateIndex
CREATE INDEX "Job_ticketId_status_startedAt_idx" ON "public"."Job"("ticketId", "status", "startedAt");

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
