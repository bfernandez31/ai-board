-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "WorkflowType" AS ENUM ('FULL', 'QUICK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable (idempotent)
DO $$ BEGIN
  ALTER TABLE "Ticket" ADD COLUMN "workflowType" "WorkflowType" NOT NULL DEFAULT 'FULL';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Ticket_projectId_workflowType_idx" ON "Ticket"("projectId", "workflowType");
