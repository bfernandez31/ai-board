-- CreateTable
CREATE TABLE "AnalysisCalibration" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "analysisId" INTEGER NOT NULL,
    "outcomeId" INTEGER NOT NULL,
    "ruleSetVersion" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" TIMESTAMP(3) NOT NULL,
    "frictionPredictedRating" VARCHAR(8) NOT NULL,
    "frictionPredictedClean" BOOLEAN NOT NULL,
    "frictionActualFree" BOOLEAN NOT NULL,
    "frictionCell" VARCHAR(2) NOT NULL,
    "qualityPredictedLower" INTEGER NOT NULL,
    "qualityPredictedUpper" INTEGER NOT NULL,
    "qualityActual" INTEGER,
    "qualityVerdict" VARCHAR(4) NOT NULL,
    "costPredictedBaselineLowerUsd" DOUBLE PRECISION NOT NULL,
    "costPredictedBaselineUpperUsd" DOUBLE PRECISION NOT NULL,
    "costPredictedMarginalLowerUsd" DOUBLE PRECISION NOT NULL,
    "costPredictedMarginalUpperUsd" DOUBLE PRECISION NOT NULL,
    "costPredictedSummedLowerUsd" DOUBLE PRECISION NOT NULL,
    "costPredictedSummedUpperUsd" DOUBLE PRECISION NOT NULL,
    "costActualUsd" DOUBLE PRECISION,
    "costVerdict" VARCHAR(4) NOT NULL,
    "recommendationPredicted" VARCHAR(5) NOT NULL,
    "recommendationConfidence" VARCHAR(6) NOT NULL,
    "workflowActual" "WorkflowType" NOT NULL,
    "recommendationMatched" BOOLEAN NOT NULL,
    "recommendationFrictionAligned" BOOLEAN NOT NULL,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "partialReason" VARCHAR(40),

    CONSTRAINT "AnalysisCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisCalibration_ticketId_key" ON "AnalysisCalibration"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisCalibration_analysisId_key" ON "AnalysisCalibration"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisCalibration_outcomeId_key" ON "AnalysisCalibration"("outcomeId");

-- CreateIndex
CREATE INDEX "AnalysisCalibration_projectId_shippedAt_idx" ON "AnalysisCalibration"("projectId", "shippedAt" DESC);

-- CreateIndex
CREATE INDEX "AnalysisCalibration_projectId_partial_idx" ON "AnalysisCalibration"("projectId", "partial");

-- CreateIndex
CREATE INDEX "AnalysisCalibration_projectId_frictionCell_idx" ON "AnalysisCalibration"("projectId", "frictionCell");

-- AddForeignKey
ALTER TABLE "AnalysisCalibration" ADD CONSTRAINT "AnalysisCalibration_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisCalibration" ADD CONSTRAINT "AnalysisCalibration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisCalibration" ADD CONSTRAINT "AnalysisCalibration_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "TicketAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisCalibration" ADD CONSTRAINT "AnalysisCalibration_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "TicketOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
