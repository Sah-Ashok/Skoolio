-- Migration: Online Payment Module
-- Run once against your database.

-- ── 1. School bank accounts (admin configures) ─────────────────────────────
CREATE TABLE IF NOT EXISTS school_bank_accounts (
  id              SERIAL PRIMARY KEY,
  school_id       INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bank_name       VARCHAR(100) NOT NULL,
  account_name    VARCHAR(100) NOT NULL,
  account_number  VARCHAR(50)  NOT NULL,
  branch          VARCHAR(100),
  ifsc_code       VARCHAR(20),
  qr_image_url    VARCHAR(500),
  upi_id          VARCHAR(100),
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_bank_accounts_school ON school_bank_accounts(school_id);

-- ── 2. Online payment requests (student submits) ────────────────────────────
CREATE TABLE IF NOT EXISTS online_payment_requests (
  id                  SERIAL PRIMARY KEY,
  school_id           INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id          INTEGER NOT NULL REFERENCES students(id),
  collection_id       INTEGER NOT NULL REFERENCES fee_collections(id),
  bank_account_id     INTEGER REFERENCES school_bank_accounts(id),
  amount              DECIMAL(12,2) NOT NULL,
  transaction_ref     VARCHAR(100),           -- UTR / transaction ID from bank
  payment_date        DATE NOT NULL,           -- date student claims to have paid
  screenshot_url      VARCHAR(500),           -- proof of payment upload
  remarks             TEXT,                   -- optional note from student
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'verified', 'rejected')),
  rejection_reason    TEXT,
  verified_by         INTEGER REFERENCES schools(id),  -- admin who verified
  verified_at         TIMESTAMP,
  fee_payment_id      INTEGER REFERENCES fee_payments(id),  -- created on verify
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opr_school   ON online_payment_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_opr_student  ON online_payment_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_opr_status   ON online_payment_requests(school_id, status);
CREATE INDEX IF NOT EXISTS idx_opr_collection ON online_payment_requests(collection_id);

COMMENT ON TABLE school_bank_accounts IS 'Bank account details entered by school admin for student payments';
COMMENT ON TABLE online_payment_requests IS 'Student-submitted online payment proofs pending admin verification';
