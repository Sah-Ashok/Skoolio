-- Migration: add unique constraint to class_subjects
-- Run once against your database before using ON CONFLICT on this table.
ALTER TABLE class_subjects
  ADD CONSTRAINT class_subjects_school_class_subject_unique
  UNIQUE (school_id, class_id, subject_id);
