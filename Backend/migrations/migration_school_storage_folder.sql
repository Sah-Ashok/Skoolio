-- =============================================================
-- Migration: Add storage_folder to schools table
-- Backfills existing verified schools with <slug>-<id> format
-- =============================================================

ALTER TABLE schools 
  ADD COLUMN IF NOT EXISTS storage_folder VARCHAR(255);

-- Backfill existing schools that don't have storage_folder yet
UPDATE schools
SET storage_folder = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(school_name), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')) || '-' || id
WHERE storage_folder IS NULL;

-- Create index for quick lookups by storage folder
CREATE INDEX IF NOT EXISTS idx_schools_storage_folder ON schools(storage_folder);

COMMENT ON COLUMN schools.storage_folder IS 'Unique folder name in school-data Azure container formatted as <school-slug>-<id>';
