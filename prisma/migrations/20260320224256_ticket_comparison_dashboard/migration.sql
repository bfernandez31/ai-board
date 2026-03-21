-- CreateTable
CREATE TABLE "ComparisonRecord" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "sourceTicketId" INTEGER NOT NULL,
    "winnerTicketId" INTEGER NOT NULL,
    "markdownPath" VARCHAR(500) NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "overallRecommendation" VARCHAR(10000) NOT NULL,
    "keyDifferentiators" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonParticipant" (
    "id" SERIAL NOT NULL,
    "comparisonRecordId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "workflowTypeAtComparison" "WorkflowType" NOT NULL,
    "agentAtComparison" "Agent",
    "rankRationale" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMetricSnapshot" (
    "id" SERIAL NOT NULL,
    "comparisonParticipantId" INTEGER NOT NULL,
    "linesAdded" INTEGER,
    "linesRemoved" INTEGER,
    "linesChanged" INTEGER,
    "filesChanged" INTEGER,
    "testFilesChanged" INTEGER,
    "changedFiles" JSONB NOT NULL,
    "bestValueFlags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionPointEvaluation" (
    "id" SERIAL NOT NULL,
    "comparisonRecordId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "verdictTicketId" INTEGER,
    "verdictSummary" VARCHAR(4000) NOT NULL,
    "rationale" VARCHAR(10000) NOT NULL,
    "participantApproaches" JSONB NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionPointEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAssessment" (
    "id" SERIAL NOT NULL,
    "comparisonParticipantId" INTEGER NOT NULL,
    "principleKey" VARCHAR(100) NOT NULL,
    "principleName" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "notes" VARCHAR(4000) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComparisonRecord_projectId_generatedAt_idx" ON "ComparisonRecord"("projectId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "ComparisonRecord_sourceTicketId_generatedAt_idx" ON "ComparisonRecord"("sourceTicketId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "ComparisonRecord_winnerTicketId_generatedAt_idx" ON "ComparisonRecord"("winnerTicketId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "ComparisonParticipant_ticketId_createdAt_idx" ON "ComparisonParticipant"("ticketId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ComparisonParticipant_comparisonRecordId_rank_idx" ON "ComparisonParticipant"("comparisonRecordId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonParticipant_comparisonRecordId_ticketId_key" ON "ComparisonParticipant"("comparisonRecordId", "ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonParticipant_comparisonRecordId_rank_key" ON "ComparisonParticipant"("comparisonRecordId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "TicketMetricSnapshot_comparisonParticipantId_key" ON "TicketMetricSnapshot"("comparisonParticipantId");

-- CreateIndex
CREATE INDEX "DecisionPointEvaluation_comparisonRecordId_displayOrder_idx" ON "DecisionPointEvaluation"("comparisonRecordId", "displayOrder");

-- CreateIndex
CREATE INDEX "DecisionPointEvaluation_verdictTicketId_idx" ON "DecisionPointEvaluation"("verdictTicketId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionPointEvaluation_comparisonRecordId_displayOrder_key" ON "DecisionPointEvaluation"("comparisonRecordId", "displayOrder");

-- CreateIndex
CREATE INDEX "ComplianceAssessment_comparisonParticipantId_displayOrder_idx" ON "ComplianceAssessment"("comparisonParticipantId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceAssessment_comparisonParticipantId_principleKey_key" ON "ComplianceAssessment"("comparisonParticipantId", "principleKey");

-- AddForeignKey
ALTER TABLE "ComparisonRecord" ADD CONSTRAINT "ComparisonRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonRecord" ADD CONSTRAINT "ComparisonRecord_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonRecord" ADD CONSTRAINT "ComparisonRecord_winnerTicketId_fkey" FOREIGN KEY ("winnerTicketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonParticipant" ADD CONSTRAINT "ComparisonParticipant_comparisonRecordId_fkey" FOREIGN KEY ("comparisonRecordId") REFERENCES "ComparisonRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonParticipant" ADD CONSTRAINT "ComparisonParticipant_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMetricSnapshot" ADD CONSTRAINT "TicketMetricSnapshot_comparisonParticipantId_fkey" FOREIGN KEY ("comparisonParticipantId") REFERENCES "ComparisonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionPointEvaluation" ADD CONSTRAINT "DecisionPointEvaluation_comparisonRecordId_fkey" FOREIGN KEY ("comparisonRecordId") REFERENCES "ComparisonRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionPointEvaluation" ADD CONSTRAINT "DecisionPointEvaluation_verdictTicketId_fkey" FOREIGN KEY ("verdictTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAssessment" ADD CONSTRAINT "ComplianceAssessment_comparisonParticipantId_fkey" FOREIGN KEY ("comparisonParticipantId") REFERENCES "ComparisonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
