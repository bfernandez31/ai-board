-- AlterTable
ALTER TABLE "TicketAnalysis" ADD COLUMN     "countedInDrift" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AnalysisOutcomePairing" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "analysisId" INTEGER NOT NULL,
    "outcomeId" INTEGER,
    "pairedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" TIMESTAMP(3) NOT NULL,
    "ruleSetVersion" INTEGER NOT NULL DEFAULT 1,
    "predictedFriction" VARCHAR(10) NOT NULL,
    "actualFrictionFree" BOOLEAN NOT NULL DEFAULT false,
    "frictionPredictedLow" BOOLEAN NOT NULL DEFAULT false,
    "frictionMatch" BOOLEAN NOT NULL DEFAULT false,
    "frictionEmerged" BOOLEAN NOT NULL DEFAULT false,
    "frictionIncomparable" BOOLEAN NOT NULL DEFAULT false,
    "predictedCostLowerUsd" DOUBLE PRECISION,
    "predictedCostUpperUsd" DOUBLE PRECISION,
    "predictedBaselineUpperUsd" DOUBLE PRECISION,
    "actualCostUsd" DOUBLE PRECISION,
    "costInRange" BOOLEAN,
    "costMissDirection" VARCHAR(8),
    "costIncomparable" BOOLEAN NOT NULL DEFAULT false,
    "predictedQualityLower" INTEGER,
    "predictedQualityUpper" INTEGER,
    "actualQualityScore" INTEGER,
    "qualityInRange" BOOLEAN,
    "qualityMissDirection" VARCHAR(8),
    "qualityIncomparable" BOOLEAN NOT NULL DEFAULT false,
    "predictedRecommendation" VARCHAR(8) NOT NULL,
    "actualWorkflowType" VARCHAR(8) NOT NULL,
    "recommendationMatch" BOOLEAN NOT NULL DEFAULT false,
    "recommendationIncomparable" BOOLEAN NOT NULL DEFAULT false,
    "unpairedReason" VARCHAR(40),
    "pendingOutcome" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AnalysisOutcomePairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisOutcomePairing_ticketId_key" ON "AnalysisOutcomePairing"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisOutcomePairing_analysisId_key" ON "AnalysisOutcomePairing"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisOutcomePairing_outcomeId_key" ON "AnalysisOutcomePairing"("outcomeId");

-- CreateIndex
CREATE INDEX "AnalysisOutcomePairing_projectId_shippedAt_idx" ON "AnalysisOutcomePairing"("projectId", "shippedAt" DESC);

-- CreateIndex
CREATE INDEX "AnalysisOutcomePairing_projectId_unpairedReason_idx" ON "AnalysisOutcomePairing"("projectId", "unpairedReason");

-- CreateIndex
CREATE INDEX "AnalysisOutcomePairing_pendingOutcome_shippedAt_idx" ON "AnalysisOutcomePairing"("pendingOutcome", "shippedAt");

-- AddForeignKey
ALTER TABLE "AnalysisOutcomePairing" ADD CONSTRAINT "AnalysisOutcomePairing_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisOutcomePairing" ADD CONSTRAINT "AnalysisOutcomePairing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisOutcomePairing" ADD CONSTRAINT "AnalysisOutcomePairing_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "TicketAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisOutcomePairing" ADD CONSTRAINT "AnalysisOutcomePairing_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "TicketOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
