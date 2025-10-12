/*
  Warnings:

  - Made the column `userId` on table `Project` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "userId" SET NOT NULL;
