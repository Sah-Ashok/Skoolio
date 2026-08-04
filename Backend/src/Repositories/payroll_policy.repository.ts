import pool from '../config/db';

export interface IPayrollPolicy {
  id: number;
  school_id: number;
  paid_leave_days_per_month: number;
  half_day_pay_percent: number;
  default_tax_percent: number;
  default_pf_percent: number;
  working_days_basis: 'manual' | 'calendar';
  created_at: string;
  updated_at: string;
}

export interface IUpsertPayrollPolicy {
  paid_leave_days_per_month: number;
  half_day_pay_percent: number;
  default_tax_percent: number;
  default_pf_percent: number;
  working_days_basis: 'manual' | 'calendar';
}

/** Get the payroll policy for a school. Returns null if not yet configured. */
export const getPayrollPolicy = async (school_id: number): Promise<IPayrollPolicy | null> => {
  const result = await pool.query(
    `SELECT * FROM payroll_policy WHERE school_id = $1`,
    [school_id]
  );
  return result.rows[0] || null;
};

/**
 * Upsert the payroll policy for a school.
 * Creates on first save, updates on subsequent saves.
 */
export const upsertPayrollPolicy = async (
  school_id: number,
  data: IUpsertPayrollPolicy
): Promise<IPayrollPolicy> => {
  const result = await pool.query(
    `INSERT INTO payroll_policy
       (school_id, paid_leave_days_per_month, half_day_pay_percent,
        default_tax_percent, default_pf_percent, working_days_basis)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (school_id) DO UPDATE SET
       paid_leave_days_per_month = EXCLUDED.paid_leave_days_per_month,
       half_day_pay_percent      = EXCLUDED.half_day_pay_percent,
       default_tax_percent       = EXCLUDED.default_tax_percent,
       default_pf_percent        = EXCLUDED.default_pf_percent,
       working_days_basis        = EXCLUDED.working_days_basis,
       updated_at                = NOW()
     RETURNING *`,
    [
      school_id,
      data.paid_leave_days_per_month,
      data.half_day_pay_percent,
      data.default_tax_percent,
      data.default_pf_percent,
      data.working_days_basis,
    ]
  );
  return result.rows[0];
};
