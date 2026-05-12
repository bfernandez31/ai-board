-- AIB-791 / review: enforce at-most-one RUNNING InsightsReport row at the
-- database level so the trigger endpoint's ALREADY_RUNNING gate cannot be
-- bypassed by concurrent POSTs (TOCTOU between read and insert).
--
-- A partial unique index keyed on a constant value gives a single eligible
-- slot for any row whose status='RUNNING'; the second concurrent insert
-- fails with a uniqueness violation, which the trigger handler translates
-- back to an ALREADY_RUNNING refusal.

CREATE UNIQUE INDEX "InsightsReport_one_running_uniq"
  ON "InsightsReport" ((1))
  WHERE "status" = 'RUNNING';
