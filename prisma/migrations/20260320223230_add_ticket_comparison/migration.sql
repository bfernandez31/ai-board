-- CreateTable
CREATE TABLE "TicketComparison" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "sourceTicketKey" VARCHAR(20) NOT NULL,
    "recommendation" VARCHAR(2000) NOT NULL,
    "winnerTicketKey" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonEntry" (
    "comparisonId" INTEGER NOT NULL,
    "ticketKey" VARCHAR(20) NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "keyDifferentiator" VARCHAR(500) NOT NULL,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "sourceFiles" INTEGER NOT NULL DEFAULT 0,
    "testFiles" INTEGER NOT NULL DEFAULT 0,
    "complianceScore" INTEGER,
    "compliancePrinciples" TEXT,
    "decisionPoints" TEXT,

    CONSTRAINT "ComparisonEntry_pkey" PRIMARY KEY ("comparisonId","ticketKey")
);

-- CreateIndex
CREATE INDEX "TicketComparison_projectId_idx" ON "TicketComparison"("projectId");

-- CreateIndex
CREATE INDEX "TicketComparison_sourceTicketKey_idx" ON "TicketComparison"("sourceTicketKey");

-- CreateIndex
CREATE INDEX "TicketComparison_createdAt_idx" ON "TicketComparison"("createdAt");

-- CreateIndex
CREATE INDEX "ComparisonEntry_ticketKey_idx" ON "ComparisonEntry"("ticketKey");

-- AddForeignKey
ALTER TABLE "ComparisonEntry" ADD CONSTRAINT "ComparisonEntry_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "TicketComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;
