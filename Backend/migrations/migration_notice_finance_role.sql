-- Allow finance role in notices table
ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_created_by_role_check;
ALTER TABLE notices ADD CONSTRAINT notices_created_by_role_check CHECK (created_by_role IN ('admin', 'faculty', 'finance'));
