-- CreateEnum
CREATE TYPE "public"."Stage" AS ENUM ('IDLE', 'PLAN', 'BUILD', 'REVIEW', 'SHIPPED', 'ERRORED');

-- CreateTable
CREATE TABLE "public"."Ticket" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "stage" "public"."Stage" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_stage_idx" ON "public"."Ticket"("stage");

-- CreateIndex
CREATE INDEX "Ticket_updatedAt_idx" ON "public"."Ticket"("updatedAt");
