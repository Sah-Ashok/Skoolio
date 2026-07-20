-- Migration: set calendar_system = 'BS' for all schools in Nepal
-- Run once. Safe to re-run (idempotent).
-- New registrations from Nepal will automatically get BS going forward.

UPDATE schools
SET calendar_system = 'BS', updated_at = NOW()
WHERE LOWER(country) = 'nepal'
  AND calendar_system = 'AD';

-- Verify
SELECT id, school_name, country, calendar_system FROM schools WHERE LOWER(country) = 'nepal';
