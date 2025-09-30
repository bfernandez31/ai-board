-- Backfill NULL descriptions with a default value before making the column required
UPDATE "Ticket"
SET description = 'No description provided'
WHERE description IS NULL;