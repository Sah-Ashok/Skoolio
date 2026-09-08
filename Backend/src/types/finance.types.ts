export interface IFinanceUser {
  id: number;
  school_id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  password?: string;
  status: 'active' | 'inactive' | 'plan_locked';
  photo?: string | null;
  role: 'finance';
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ICreateFinanceUser {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface IUpdateFinanceUser {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: 'active' | 'inactive' | 'plan_locked';
}
