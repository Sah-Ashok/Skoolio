-- History / Activity Log Module
-- Run once against your database.
-- Stores all school-scoped actions. Create-only: no UPDATE or DELETE allowed via API.
-- Retention: 3 months per school (purge via scheduled job or manual call to DELETE endpoint for super_admin).

CREATE TABLE IF NOT EXISTS activity_logs (
  id            SERIAL PRIMARY KEY,
  school_id     INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  actor_id      INTEGER,                         -- schools.id for admin, teachers.id / students.id for users
  actor_role    VARCHAR(20) NOT NULL,            -- 'admin' | 'super_admin' | 'faculty' | 'student'
  actor_name    VARCHAR(255),                    -- denormalised display name at time of action
  module        VARCHAR(50)  NOT NULL,           -- 'students' | 'fees' | 'attendance' | 'exams' etc.
  action        VARCHAR(50)  NOT NULL,           -- 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' etc.
  entity_id     INTEGER,                         -- id of the affected record (nullable for bulk ops)
  entity_label  VARCHAR(255),                    -- human-readable label e.g. "John Doe (ADM-001)"
  description   TEXT         NOT NULL,           -- full human-readable summary of what changed
  ip_address    VARCHAR(45),                     -- IPv4 / IPv6
  user_agent    VARCHAR(500),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for the primary read pattern: a school's recent logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_school_created
  ON activity_logs (school_id, created_at DESC);

-- Index for filtering by module
CREATE INDEX IF NOT EXISTS idx_activity_logs_module
  ON activity_logs (school_id, module);

-- Index for filtering by actor
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor
  ON activity_logs (school_id, actor_id, actor_role);
