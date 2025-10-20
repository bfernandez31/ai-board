-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "attachments" JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN "Ticket"."attachments" IS 'JSON array of TicketAttachment objects (max 5 items)';
