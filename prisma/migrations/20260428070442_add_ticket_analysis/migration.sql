-- CreateEnum
CREATE TYPE "TicketAnalysisStatus" AS ENUM ('running', 'success', 'cold_start', 'failed');

-- CreateTable
CREATE TABLE "TicketAnalysis" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TicketAnalysisStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleSetVersion" INTEGER NOT NULL,
    "agent" "Agent" NOT NULL,
    "modelId" VARCHAR(50),
    "titleSnapshot" VARCHAR(100) NOT NULL,
    "descriptionSnapshot" VARCHAR(10000) NOT NULL,
    "stackSnapshot" JSONB NOT NULL,
    "costUsd" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "thinkingTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "coldStartReason" VARCHAR(40),
    "errorReason" VARCHAR(40),
    "errorMessage" VARCHAR(2000),
    "output" JSONB,
    "anchorIdsAttempted" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "TicketAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketAnalysis_ticketId_createdAt_idx" ON "TicketAnalysis"("ticketId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TicketAnalysis_userId_status_endedAt_idx" ON "TicketAnalysis"("userId", "status", "endedAt");

-- CreateIndex
CREATE INDEX "TicketAnalysis_projectId_createdAt_idx" ON "TicketAnalysis"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TicketAnalysis_status_startedAt_idx" ON "TicketAnalysis"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "TicketAnalysis" ADD CONSTRAINT "TicketAnalysis_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAnalysis" ADD CONSTRAINT "TicketAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAnalysis" ADD CONSTRAINT "TicketAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
