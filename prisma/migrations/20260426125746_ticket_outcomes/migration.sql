-- CreateEnum
CREATE TYPE "BackfillStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "TicketOutcome" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "workflowType" "WorkflowType" NOT NULL,
    "shippedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleSetVersion" INTEGER NOT NULL,
    "totalCostUsd" DOUBLE PRECISION,
    "totalDurationMs" INTEGER,
    "totalInputTokens" INTEGER,
    "totalOutputTokens" INTEGER,
    "totalThinkingTokens" INTEGER,
    "totalCacheReadTokens" INTEGER,
    "totalCacheCreationTokens" INTEGER,
    "toolsUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pipelineJobCount" INTEGER NOT NULL DEFAULT 0,
    "frictionJobCount" INTEGER NOT NULL DEFAULT 0,
    "totalJobCount" INTEGER NOT NULL DEFAULT 0,
    "jobCountByPrefix" JSONB NOT NULL DEFAULT '{}',
    "qualityScore" INTEGER,
    "filesTouched" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linesAdded" INTEGER,
    "linesRemoved" INTEGER,
    "testCodeRatio" DOUBLE PRECISION,
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domainFileCounts" JSONB NOT NULL DEFAULT '{}',
    "touchedDbSchema" BOOLEAN NOT NULL DEFAULT false,
    "touchedTests" BOOLEAN NOT NULL DEFAULT false,
    "touchedCi" BOOLEAN NOT NULL DEFAULT false,
    "frictionFree" BOOLEAN NOT NULL DEFAULT false,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "partialReason" VARCHAR(40),

    CONSTRAINT "TicketOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackfillProgress" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "status" "BackfillStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "lastProcessedTicketId" INTEGER,
    "ticketsProcessed" INTEGER NOT NULL DEFAULT 0,
    "ticketsWithPartial" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastError" VARCHAR(2000),

    CONSTRAINT "BackfillProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketOutcome_ticketId_key" ON "TicketOutcome"("ticketId");

-- CreateIndex
CREATE INDEX "TicketOutcome_projectId_shippedAt_idx" ON "TicketOutcome"("projectId", "shippedAt" DESC);

-- CreateIndex
CREATE INDEX "TicketOutcome_projectId_frictionFree_idx" ON "TicketOutcome"("projectId", "frictionFree");

-- CreateIndex
CREATE INDEX "TicketOutcome_projectId_partial_idx" ON "TicketOutcome"("projectId", "partial");

-- CreateIndex
CREATE INDEX "TicketOutcome_shippedAt_idx" ON "TicketOutcome"("shippedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackfillProgress_projectId_key" ON "BackfillProgress"("projectId");

-- CreateIndex
CREATE INDEX "BackfillProgress_status_idx" ON "BackfillProgress"("status");

-- AddForeignKey
ALTER TABLE "TicketOutcome" ADD CONSTRAINT "TicketOutcome_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOutcome" ADD CONSTRAINT "TicketOutcome_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillProgress" ADD CONSTRAINT "BackfillProgress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
