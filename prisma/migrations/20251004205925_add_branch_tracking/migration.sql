-- AlterTable
ALTER TABLE "public"."Ticket" ADD COLUMN     "autoMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "branch" VARCHAR(200);
