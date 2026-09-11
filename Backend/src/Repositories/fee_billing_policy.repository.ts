import pool from '../config/db';
import { IFeeBillingPolicy, IUpsertFeeBillingPolicy, FEE_BILLING_POLICY_DEFAULTS } from '../types/fee_billing_policy.types';

export const getFeeBillingPolicy = async (school_id: number): Promise<IFeeBillingPolicy> => {
  const result = await pool.query<IFeeBillingPolicy>(
    `SELECT * FROM fee_billing_policy WHERE school_id = $1`,
    [school_id]
  );
  if (result.rows.length === 0) {
    // Return defaults without persisting — first PUT will create the row
    return {
      id: 0,
      school_id,
      ...FEE_BILLING_POLICY_DEFAULTS,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }
  const row = result.rows[0];
  return {
    ...row,
    show_pending_popup_on_login: row.show_pending_popup_on_login ?? true,
  };
};

export const upsertFeeBillingPolicy = async (
  school_id: number,
  data: IUpsertFeeBillingPolicy
): Promise<IFeeBillingPolicy> => {
  const show_pending = data.show_pending_popup_on_login ?? true;
  const result = await pool.query<IFeeBillingPolicy>(
    `INSERT INTO fee_billing_policy
       (school_id, billing_start_from, monthly_bill_window, overdue_grace_days, show_pending_popup_on_login)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (school_id) DO UPDATE SET
       billing_start_from          = EXCLUDED.billing_start_from,
       monthly_bill_window         = EXCLUDED.monthly_bill_window,
       overdue_grace_days          = EXCLUDED.overdue_grace_days,
       show_pending_popup_on_login = EXCLUDED.show_pending_popup_on_login,
       updated_at                  = NOW()
     RETURNING *`,
    [school_id, data.billing_start_from, data.monthly_bill_window, data.overdue_grace_days, show_pending]
  );
  return result.rows[0];
};
