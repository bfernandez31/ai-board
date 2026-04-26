-- CreateTable
CREATE TABLE "TicketOutcome" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "pipelineJobCount" INTEGER NOT NULL DEFAULT 0,
    "frictionJobCount" INTEGER NOT NULL DEFAULT 0,
    "finalQualityScore" INTEGER,
    "filesTouched" INTEGER,
    "linesAdded" INTEGER,
    "linesRemoved" INTEGER,
    "codeFilesChanged" INTEGER,
    "testFilesChanged" INTEGER,
    "structuralDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "semanticTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frictionFree" BOOLEAN NOT NULL DEFAULT false,
    "hasCommitData" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketOutcome_ticketId_key" ON "TicketOutcome"("ticketId");

-- CreateIndex
CREATE INDEX "TicketOutcome_projectId_idx" ON "TicketOutcome"("projectId");

-- CreateIndex
CREATE INDEX "TicketOutcome_projectId_frictionFree_idx" ON "TicketOutcome"("projectId", "frictionFree");

-- CreateIndex
CREATE INDEX "TicketOutcome_projectId_computedAt_idx" ON "TicketOutcome"("projectId", "computedAt" DESC);

-- AddForeignKey
ALTER TABLE "TicketOutcome" ADD CONSTRAINT "TicketOutcome_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
