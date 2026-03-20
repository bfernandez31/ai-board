-- CreateTable
CREATE TABLE "TicketComparison" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "sourceTicketId" INTEGER NOT NULL,
    "winnerTicketId" INTEGER,
    "reportFilename" VARCHAR(255) NOT NULL,
    "reportPath" VARCHAR(500) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "summary" VARCHAR(4000) NOT NULL,
    "recommendation" VARCHAR(4000) NOT NULL,
    "decisionPoints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComparisonEntry" (
    "id" SERIAL NOT NULL,
    "comparisonId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "verdictSummary" VARCHAR(4000) NOT NULL,
    "keyDifferentiators" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metrics" JSONB NOT NULL,
    "constitution" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComparisonEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketComparison_projectId_generatedAt_idx" ON "TicketComparison"("projectId", "generatedAt");

-- CreateIndex
CREATE INDEX "TicketComparison_sourceTicketId_generatedAt_idx" ON "TicketComparison"("sourceTicketId", "generatedAt");

-- CreateIndex
CREATE INDEX "TicketComparison_winnerTicketId_idx" ON "TicketComparison"("winnerTicketId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketComparison_projectId_reportFilename_key" ON "TicketComparison"("projectId", "reportFilename");

-- CreateIndex
CREATE INDEX "TicketComparisonEntry_ticketId_comparisonId_idx" ON "TicketComparisonEntry"("ticketId", "comparisonId");

-- CreateIndex
CREATE INDEX "TicketComparisonEntry_ticketId_createdAt_idx" ON "TicketComparisonEntry"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketComparisonEntry_comparisonId_ticketId_key" ON "TicketComparisonEntry"("comparisonId", "ticketId");

-- AddForeignKey
ALTER TABLE "TicketComparison" ADD CONSTRAINT "TicketComparison_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComparison" ADD CONSTRAINT "TicketComparison_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComparison" ADD CONSTRAINT "TicketComparison_winnerTicketId_fkey" FOREIGN KEY ("winnerTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComparisonEntry" ADD CONSTRAINT "TicketComparisonEntry_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "TicketComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComparisonEntry" ADD CONSTRAINT "TicketComparisonEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
