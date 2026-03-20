-- DropForeignKey
ALTER TABLE "public"."Comparison" DROP CONSTRAINT "Comparison_projectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Comparison" DROP CONSTRAINT "Comparison_sourceTicketId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ComparisonEntry" DROP CONSTRAINT "ComparisonEntry_ticketId_fkey";

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonEntry" ADD CONSTRAINT "ComparisonEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
