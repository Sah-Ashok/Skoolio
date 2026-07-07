// Enums
export type ExpensePaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'online';

// ── EXPENSE CATEGORY ──
export interface IExpenseCategory {
  id: number;
  school_id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateExpenseCategory = Pick<IExpenseCategory, 'name'>;
export type IUpdateExpenseCategory = Partial<ICreateExpenseCategory>;

// ── EXPENSE ──
export interface IExpense {
  id: number;
  school_id: number;
  academic_year_id: number;
  category_id: number;
  title: string;
  amount: number;
  expense_date: Date;
  payment_method: ExpensePaymentMethod;
  receipt_number?: string;
  vendor_name?: string;
  attachment_url?: string;
  description?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export type ICreateExpense = Pick<
  IExpense,
  | 'academic_year_id'
  | 'category_id'
  | 'title'
  | 'amount'
  | 'expense_date'
  | 'payment_method'
> & {
  receipt_number?: string;
  vendor_name?: string;
  attachment_url?: string;
  description?: string;
};

export type IUpdateExpense = Partial<ICreateExpense>;

// ── EXPENSE SUMMARY ──
export interface IExpenseSummary {
  category_name: string;
  total_amount: number;
  count: number;
}