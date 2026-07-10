-- ============================================================
-- Staff Management Migration
-- Non-teaching staff: cleaners, wardens, security, cooks, etc.
-- ============================================================

-- 1. Staff roles (school-defined: cleaner, warden, security, etc.)
CREATE TABLE IF NOT EXISTS staff_roles (
  id         SERIAL PRIMARY KEY,
  school_id  INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role_name  VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, role_name)
);

-- 2. Staff members
CREATE TABLE IF NOT EXISTS staff (
  id             SERIAL PRIMARY KEY,
  school_id      INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_role_id  INTEGER NOT NULL REFERENCES staff_roles(id) ON DELETE RESTRICT,
  full_name      VARCHAR(200) NOT NULL,
  phone          VARCHAR(20),
  address        TEXT,
  gender         VARCHAR(10) CHECK (gender IN ('male','female','other')),
  date_of_birth  DATE,
  joined_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','on_leave','terminated')),
  photo          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Salary structure (one active row per staff; tracks revisions via effective_from)
CREATE TABLE IF NOT EXISTS staff_salary_structure (
  id             SERIAL PRIMARY KEY,
  school_id      INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id       INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  basic_salary   NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Monthly salary payments (one row per staff per month)
CREATE TABLE IF NOT EXISTS staff_salary_payments (
  id               SERIAL PRIMARY KEY,
  school_id        INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id         INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  salary_month     DATE NOT NULL,              -- store as YYYY-MM-01 (first of the month)
  gross_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount       NUMERIC(12,2) GENERATED ALWAYS AS (gross_amount - total_deductions) STORED,
  payment_method   VARCHAR(30) CHECK (payment_method IN ('cash','bank_transfer','cheque')),
  paid_on          DATE,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('paid','pending','cancelled')),
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, staff_id, salary_month)
);

-- 5. Deduction line items (per payment)
CREATE TABLE IF NOT EXISTS staff_salary_deductions (
  id                 SERIAL PRIMARY KEY,
  school_id          INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  salary_payment_id  INTEGER NOT NULL REFERENCES staff_salary_payments(id) ON DELETE CASCADE,
  deduction_type     VARCHAR(50) NOT NULL
                       CHECK (deduction_type IN ('absent','advance','tax','provident_fund','other')),
  amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Daily attendance
CREATE TABLE IF NOT EXISTS staff_attendance (
  id         SERIAL PRIMARY KEY,
  school_id  INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'present'
               CHECK (status IN ('present','absent','leave','half_day')),
  check_in   TIME,
  check_out  TIME,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, staff_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_school           ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_role             ON staff(staff_role_id);
CREATE INDEX IF NOT EXISTS idx_staff_salary_struct    ON staff_salary_structure(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_salary_payments  ON staff_salary_payments(staff_id, salary_month);
CREATE INDEX IF NOT EXISTS idx_staff_salary_deduct    ON staff_salary_deductions(salary_payment_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance       ON staff_attendance(staff_id, date);
