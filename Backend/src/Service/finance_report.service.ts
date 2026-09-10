import {
  getFeeReportData,
  getIncomeExpenseReportData,
} from '../Repositories/finance_report.repository';

export const getFeeReportService = async (school_id: number, academic_year_id: number) => {
  return await getFeeReportData(school_id, academic_year_id);
};

export const getIncomeExpenseReportService = async (school_id: number, academic_year_id: number) => {
  return await getIncomeExpenseReportData(school_id, academic_year_id);
};
