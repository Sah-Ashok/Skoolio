-- Migration: add calendar_system to schools
-- Run once against your database.
-- Controls whether the school's UI shows dates in AD (Gregorian) or BS (Bikram Sambat).
-- The DB always stores dates in AD — this is purely a display preference.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS calendar_system VARCHAR(2) NOT NULL DEFAULT 'AD'
    CHECK (calendar_system IN ('AD', 'BS'));

COMMENT ON COLUMN schools.calendar_system IS
  'Date display system: AD = Gregorian (default), BS = Bikram Sambat (Nepal). DB always stores AD internally.';
