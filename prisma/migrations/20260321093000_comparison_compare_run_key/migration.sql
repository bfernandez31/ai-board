ALTER TABLE "ComparisonRecord"
ADD COLUMN "compareRunKey" VARCHAR(255);

CREATE UNIQUE INDEX "ComparisonRecord_projectId_sourceTicketId_compareRunKey_key"
ON "ComparisonRecord"("projectId", "sourceTicketId", "compareRunKey");
