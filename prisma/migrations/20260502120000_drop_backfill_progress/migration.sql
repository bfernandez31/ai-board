-- DropForeignKey
ALTER TABLE "BackfillProgress" DROP CONSTRAINT "BackfillProgress_projectId_fkey";

-- DropTable
DROP TABLE "BackfillProgress";

-- DropEnum
DROP TYPE "BackfillStatus";
