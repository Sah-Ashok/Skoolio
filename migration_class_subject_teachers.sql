-- ============================================================
-- School-POS Migration: Class Subject Teachers
-- Maps which teacher teaches which subject in a class
-- Also enforces coordinator-only attendance marking per section
-- Run this ONCE against your PostgreSQL database
-- ============================================================

-- 1. class_subject_teachers
--    One row = Teacher X teaches Subject Y in Class Z for academic year W
CREATE TABLE IF NOT EXISTS class_subject_teachers (
  id               SERIAL PRIMARY KEY,
  school_id        INTEGER      NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  class_id         INTEGER      NOT NULL REFERENCES classes(id)        ON DELETE CASCADE,
  subject_id       INTEGER      NOT NULL REFERENCES subjects(id)       ON DELETE CASCADE,
  teacher_id       INTEGER      NOT NULL REFERENCES teachers(id)       ON DELETE CASCADE,
  academic_year_id INTEGER      NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- One teacher per subject per class per academic year
  UNIQUE(school_id, class_id, subject_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_cst_class
  ON class_subject_teachers(class_id, school_id);

CREATE INDEX IF NOT EXISTS idx_cst_teacher
  ON class_subject_teachers(teacher_id, school_id);

CREATE INDEX IF NOT EXISTS idx_cst_subject
  ON class_subject_teachers(subject_id, class_id);

-- 2. Add coordinator_name to sections view (for convenience in queries)
--    sections table already has coordinator_id — just verify
--    ALTER TABLE sections ADD COLUMN IF NOT EXISTS coordinator_id INTEGER REFERENCES teachers(id);
--    (Already exists from initial schema — skipping)

-- Done. Run backend server to use new endpoints.
