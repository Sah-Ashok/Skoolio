-- ============================================================
-- Notice Board Module Migration
-- Run once against your database.
-- ============================================================

CREATE TABLE IF NOT EXISTS notices (
  id                SERIAL PRIMARY KEY,
  school_id         INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Who created it
  created_by_role   VARCHAR(10) NOT NULL CHECK (created_by_role IN ('admin', 'faculty')),
  created_by_id     INTEGER NOT NULL,          -- school.id for admin, teachers.id for faculty
  created_by_name   VARCHAR(255) NOT NULL,     -- denormalised display name

  -- Content
  title             VARCHAR(255) NOT NULL,
  content           TEXT NOT NULL,

  -- Targeting
  -- NULL target_type  → visible to everyone in the school (admin notice)
  -- 'section'         → visible only to a specific section (teacher notice)
  target_type       VARCHAR(20) DEFAULT NULL CHECK (target_type IN ('section', NULL)),
  target_section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,

  -- Features
  is_pinned         BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at        DATE DEFAULT NULL,          -- NULL = never expires

  -- Status
  status            VARCHAR(10) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived')),

  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notices_school_id        ON notices(school_id);
CREATE INDEX IF NOT EXISTS idx_notices_target_section   ON notices(target_section_id);
CREATE INDEX IF NOT EXISTS idx_notices_is_pinned        ON notices(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notices_expires_at       ON notices(expires_at);
CREATE INDEX IF NOT EXISTS idx_notices_status           ON notices(status);
