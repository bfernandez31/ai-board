-- AlterTable
ALTER TABLE "Project" ADD COLUMN "claudeModels" JSONB;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "claudeModelOverrides" JSONB;
