-- ============================================================
-- Migration: Create finance_users table (1 dedicated per school)
-- For SchoolPOS / Skoolio Platform
-- Plan Gating: Plus & Ultra tiers only
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_users (
  id              SERIAL PRIMARY KEY,
  school_id       INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  phone           VARCHAR(30),
  password        VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  photo           VARCHAR(500),
  role            VARCHAR(20) NOT NULL DEFAULT 'finance',
  last_login_at   TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  -- STRICT ENFORCEMENT: 1 school can have at most 1 finance manager
  CONSTRAINT uq_school_finance_single UNIQUE (school_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_users_school_id ON finance_users(school_id);
CREATE INDEX IF NOT EXISTS idx_finance_users_email ON finance_users(email);