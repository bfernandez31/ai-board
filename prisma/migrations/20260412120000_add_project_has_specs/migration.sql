-- AlterTable: Add hasSpecs boolean field to Project
ALTER TABLE "Project" ADD COLUMN "hasSpecs" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: Set hasSpecs = true for projects that already have a COMPLETED RETRO_SPEC job
UPDATE "Project" p
SET "hasSpecs" = true
WHERE EXISTS (
  SELECT 1 FROM "ProjectSetupJob" j
  WHERE j."projectId" = p."id"
    AND j."command" = 'RETRO_SPEC'
    AND j."status" = 'COMPLETED'
);
