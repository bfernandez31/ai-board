-- Add version column to Ticket table
ALTER TABLE "Ticket" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Create new enum with aligned stage names
CREATE TYPE "Stage_new" AS ENUM ('INBOX', 'PLAN', 'BUILD', 'VERIFY', 'SHIP');

-- Drop existing default before type change
ALTER TABLE "Ticket" ALTER COLUMN "stage" DROP DEFAULT;

-- Convert stage column to use new enum, mapping old values to new ones
ALTER TABLE "Ticket" ALTER COLUMN "stage" TYPE "Stage_new"
USING (
  CASE "stage"::text
    WHEN 'IDLE' THEN 'INBOX'
    WHEN 'PLAN' THEN 'PLAN'
    WHEN 'BUILD' THEN 'BUILD'
    WHEN 'REVIEW' THEN 'VERIFY'
    WHEN 'SHIPPED' THEN 'SHIP'
    WHEN 'ERRORED' THEN 'INBOX'
    ELSE 'INBOX'
  END::"Stage_new"
);

-- Drop old enum
DROP TYPE "Stage";

-- Rename new enum to replace old one
ALTER TYPE "Stage_new" RENAME TO "Stage";

-- Set new default after enum is renamed
ALTER TABLE "Ticket" ALTER COLUMN "stage" SET DEFAULT 'INBOX'::"Stage";
