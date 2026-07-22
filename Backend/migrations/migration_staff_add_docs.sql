-- Add citizen_id and license_number to staff table
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS citizen_id     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);
