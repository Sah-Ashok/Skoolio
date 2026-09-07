export interface DashboardFeeMonthly {
  month: string;
  collected: number;
  pending: number;
}

export interface DashboardAdmissionMonthly {
  month: string;
  admissions: number;
}

export interface DashboardExpenseCategory {
  category: string;
  amount: number;
  color?: string;
}

export interface DashboardNotice {
  id: number;
  title: string;
  category?: string;
  created_at: string;
  content?: string;
}

export interface DashboardRecentStudent {
  id: number;
  full_name: string;
  class_name: string;
  section_name?: string;
  admission_number?: string;
  created_at: string;
}

export interface DashboardRecentExpense {
  id: number;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
}

export interface DashboardRecentSalary {
  id: number;
  full_name: string;
  role_name?: string;
  net_salary: number;
  status: string;
  payment_date?: string;
}

export interface DashboardData {
  totalStudents: number;
  activeStudents: number;
  newThisMonth: number;
  totalTeachers: number;
  activeTeachers: number;
  totalClasses: number;
  totalSections: number;

  totalAssigned: number;
  totalCollected: number;
  totalPending: number;
  overdueAmount: number;
  pendingStudents: number;
  pendingBills: number;
  collectionRate: number;

  totalExpenses: number;
  expenseCount: number;
  expenseBreakdown: DashboardExpenseCategory[];

  salaryPaidCount: number;
  salaryTotal: number;
  salaryPaidAmt: number;

  currency: string;
  currencySymbol: string;
  netBalance: number;

  feeMonthly: DashboardFeeMonthly[];
  admissionsMonthly: DashboardAdmissionMonthly[];

  recentStudents: DashboardRecentStudent[];
  recentExpenses: DashboardRecentExpense[];
  recentSalaries: DashboardRecentSalary[];
  notices: DashboardNotice[];
}
