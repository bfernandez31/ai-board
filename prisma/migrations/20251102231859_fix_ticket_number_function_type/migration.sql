-- Fix get_next_ticket_number function parameter type
-- Issue: Prisma passes projectId as BIGINT but function expects INT
-- Solution: Recreate function with BIGINT parameter type

-- Drop existing function (supports both INT and BIGINT signatures)
DROP FUNCTION IF EXISTS get_next_ticket_number(INT);
DROP FUNCTION IF EXISTS get_next_ticket_number(BIGINT);

-- Recreate function with BIGINT parameter to match Prisma's type handling
CREATE OR REPLACE FUNCTION get_next_ticket_number(project_id BIGINT)
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
