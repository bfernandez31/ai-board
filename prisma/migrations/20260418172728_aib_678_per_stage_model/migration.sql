-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "implementModel" VARCHAR(50),
ADD COLUMN     "planModel" VARCHAR(50),
ADD COLUMN     "quickImplModel" VARCHAR(50),
ADD COLUMN     "specifyModel" VARCHAR(50),
ADD COLUMN     "verifyModel" VARCHAR(50);

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "implementModel" VARCHAR(50),
ADD COLUMN     "planModel" VARCHAR(50),
ADD COLUMN     "quickImplModel" VARCHAR(50),
ADD COLUMN     "specifyModel" VARCHAR(50),
ADD COLUMN     "verifyModel" VARCHAR(50);
