-- Migration: feedback module (admin + teacher only)
-- Run once. All additions are IF NOT EXISTS — safe to re-run.

CREATE TABLE IF NOT EXISTS feedback (
  id              SERIAL        PRIMARY KEY,
  school_id       INTEGER       NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  submitted_by    INTEGER       NOT NULL,
  role            VARCHAR(10)   NOT NULL CHECK (role IN ('admin', 'faculty')),
  submitter_name  VARCHAR(200)  NOT NULL,
  category        VARCHAR(40)   NOT NULL CHECK (category IN (
                    'bug', 'feature_request', 'ui_improvement',
                    'performance', 'general', 'other'
                  )),
  title           VARCHAR(200)  NOT NULL,
  description     TEXT          NOT NULL,
  rating          SMALLINT      CHECK (rating BETWEEN 1 AND 5),
  status          VARCHAR(20)   NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  priority        VARCHAR(10)   NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
  admin_response  TEXT,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_school   ON feedback(school_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status   ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_role     ON feedback(role);

COMMENT ON TABLE  feedback                 IS 'Feedback submitted by school admins and teachers to the platform';
COMMENT ON COLUMN feedback.submitted_by    IS 'teacher.id for faculty, school.id for admin';
COMMENT ON COLUMN feedback.rating          IS '1=terrible 2=poor 3=ok 4=good 5=excellent';
COMMENT ON COLUMN feedback.admin_response  IS 'Platform super-admin response to the feedback';
