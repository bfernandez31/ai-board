-- CreateTable
CREATE TABLE "Comparison" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "sourceTicketId" INTEGER NOT NULL,
    "recommendation" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonEntry" (
    "id" SERIAL NOT NULL,
    "comparisonId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "keyDifferentiators" TEXT NOT NULL,
    "linesAdded" INTEGER NOT NULL,
    "linesRemoved" INTEGER NOT NULL,
    "sourceFileCount" INTEGER NOT NULL,
    "testFileCount" INTEGER NOT NULL,
    "testRatio" DOUBLE PRECISION NOT NULL,
    "complianceData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonDecisionPoint" (
    "id" SERIAL NOT NULL,
    "comparisonId" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "approaches" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonDecisionPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comparison_projectId_idx" ON "Comparison"("projectId");

-- CreateIndex
CREATE INDEX "Comparison_sourceTicketId_idx" ON "Comparison"("sourceTicketId");

-- CreateIndex
CREATE INDEX "ComparisonEntry_comparisonId_idx" ON "ComparisonEntry"("comparisonId");

-- CreateIndex
CREATE INDEX "ComparisonEntry_ticketId_idx" ON "ComparisonEntry"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonEntry_comparisonId_ticketId_key" ON "ComparisonEntry"("comparisonId", "ticketId");

-- CreateIndex
CREATE INDEX "ComparisonDecisionPoint_comparisonId_idx" ON "ComparisonDecisionPoint"("comparisonId");

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonEntry" ADD CONSTRAINT "ComparisonEntry_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonEntry" ADD CONSTRAINT "ComparisonEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonDecisionPoint" ADD CONSTRAINT "ComparisonDecisionPoint_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;
