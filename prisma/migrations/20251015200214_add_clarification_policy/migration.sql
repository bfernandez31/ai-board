-- CreateEnum
CREATE TYPE "ClarificationPolicy" AS ENUM ('AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "clarificationPolicy" "ClarificationPolicy" NOT NULL DEFAULT 'AUTO';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "clarificationPolicy" "ClarificationPolicy";
