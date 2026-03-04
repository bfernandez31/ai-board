-- CreateEnum
CREATE TYPE "Agent" AS ENUM ('CLAUDE', 'CODEX');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "defaultAgent" "Agent" NOT NULL DEFAULT 'CLAUDE';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "agent" "Agent";
