-- Jira-Style Ticket Numbering Migration
-- This migration adds project keys and ticket numbering fields

BEGIN;

-- Phase 1: Add columns as nullable
ALTER TABLE "Project" ADD COLUMN "key" VARCHAR(6);
ALTER TABLE "Ticket" ADD COLUMN "ticketNumber" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "ticketKey" VARCHAR(20);

-- Phase 2: Create sequence function
CREATE OR REPLACE FUNCTION get_next_ticket_number(project_id INT)
RETURNS INT AS $$
DECLARE
  seq_name TEXT;
  next_num INT;
BEGIN
  seq_name := 'ticket_seq_project_' || project_id;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', seq_name);
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_num;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Phase 3: Populate project keys
-- Strategy: Generate from first 3-6 chars of name, handle collisions
DO $$
DECLARE
  project RECORD;
  base_key TEXT;
  final_key TEXT;
  counter INT;
  key_length INT;
BEGIN
  FOR project IN SELECT id, name FROM "Project" ORDER BY id LOOP
    -- Generate base key from name (extract up to 6 alphanumeric characters)
    base_key := UPPER(LEFT(REGEXP_REPLACE(project.name, '[^A-Za-z0-9]', '', 'g'), 6));

    -- Pad if too short (minimum 3 characters)
    IF LENGTH(base_key) < 3 THEN
      base_key := RPAD(base_key, 3, 'X');
    END IF;

    -- Try base key first (prefer longer keys if possible, but start with 3 chars)
    key_length := LEAST(3, LENGTH(base_key));
    final_key := LEFT(base_key, key_length);

    -- Handle collisions by appending digits or using longer key
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM "Project" WHERE "key" = final_key) LOOP
      -- First try longer key from base_key if available
      IF key_length < LENGTH(base_key) AND key_length < 6 THEN
        key_length := key_length + 1;
        final_key := LEFT(base_key, key_length);
      ELSE
        -- If exhausted longer keys, append counter
        final_key := LEFT(base_key, LEAST(5, LENGTH(base_key))) || counter;
        counter := counter + 1;
      END IF;
    END LOOP;

    -- Assign key
    UPDATE "Project" SET "key" = final_key WHERE id = project.id;
  END LOOP;
END $$;

-- Phase 4: Populate ticket numbers and keys
WITH numbered_tickets AS (
  SELECT
    id,
    "projectId",
    ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt", id) AS ticket_num
  FROM "Ticket"
)
UPDATE "Ticket" t
SET "ticketNumber" = nt.ticket_num
FROM numbered_tickets nt
WHERE t.id = nt.id;

-- Populate ticket keys
UPDATE "Ticket" t
SET "ticketKey" = p.key || '-' || t."ticketNumber"
FROM "Project" p
WHERE t."projectId" = p.id;

-- Phase 5: Add constraints
ALTER TABLE "Project" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "ticketNumber" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "ticketKey" SET NOT NULL;

ALTER TABLE "Project" ADD CONSTRAINT "Project_key_key" UNIQUE ("key");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketKey_key" UNIQUE ("ticketKey");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_ticketNumber_key" UNIQUE ("projectId", "ticketNumber");

-- Phase 6: Create indexes
CREATE INDEX "Project_key_idx" ON "Project"("key");
CREATE INDEX "Ticket_ticketKey_idx" ON "Ticket"("ticketKey");

-- Phase 7: Initialize sequences with current max values
DO $$
DECLARE
  project RECORD;
  seq_name TEXT;
  max_num INT;
BEGIN
  FOR project IN SELECT id FROM "Project" LOOP
    seq_name := 'ticket_seq_project_' || project.id;
    SELECT COALESCE(MAX("ticketNumber"), 0) INTO max_num
    FROM "Ticket"
    WHERE "projectId" = project.id;
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH %s', seq_name, max_num + 1);
  END LOOP;
END $$;

COMMIT;
