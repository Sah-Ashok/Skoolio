'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/lib/useApi';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useCurrency } from '@/lib/useCurrency';
import Loader from '@/components/shared/Loader';
import styles from './report.module.css';

interface MonthlyReportRow {
  month: string;
  income: number | string;
  expense: number | string;
  net: number | string;
  trend: 'up' | 'down';
}

interface CategoryBreakdownItem {
  name: string;
  amount: number | string;
  percent: number;
}

export default function FinanceIncomeExpenseReportPage() {
  const { activeYear } = useAcademicYear();
  const { fmt } = useCurrency();

  const { data: yearsData } = useApi<any[]>('/academic-years');
  const yearsList = useMemo(() => {
    if (Array.isArray(yearsData)) return yearsData;
    if (Array.isArray((yearsData as any)?.data)) return (yearsData as any).data;
    return [];
  }, [yearsData]);

  const [selectedYearId, setSelectedYearId] = useState<string>(
    activeYear?.id ? String(activeYear.id) : ''
  );

  useEffect(() => {
    if (!selectedYearId && activeYear?.id) {
      setSelectedYearId(String(activeYear.id));
    }
  }, [activeYear, selectedYearId]);

  const currentYearId = selectedYearId || (activeYear?.id ? String(activeYear.id) : '');

  const { data, loading } = useApi<{
    summary?: {
      total_income?: number | string;
      total_expense?: number | string;
      net_balance?: number | string;
      is_surplus?: boolean;
    };
    months?: MonthlyReportRow[];
    income_categories?: CategoryBreakdownItem[];
    expense_categories?: CategoryBreakdownItem[];
  }>(currentYearId ? `/finance/reports/income-expense?academic_year_id=${currentYearId}` : '');

  const months = data?.months || [];
  const incomeCats = data?.income_categories || [];
  const expenseCats = data?.expense_categories || [];

  return (
    <div className={styles.pageWrap}>

      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Financial Income &amp; Expense Statement</h1>
          <p className={styles.subtitle}>Comprehensive ledger overview of institutional revenues vs operational disbursements</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: 13.5,
              fontWeight: 700,
              color: '#334155',
              background: '#ffffff',
            }}
            value={currentYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
          >
            {yearsList.length > 0 ? (
              yearsList.map((y: any) => (
                <option key={y.id} value={String(y.id)}>
                  {y.year_name || y.name} {y.is_active ? '(Current)' : ''}
                </option>
              ))
            ) : (
              <option value="">{activeYear?.year_name || 'Active Session'}</option>
            )}
          </select>

          <button
            className={styles.exportBtn}
            onClick={() => window.print()}
          >
            <i className="fa-solid fa-print" /> Print Statement
          </button>
        </div>
      </div>

      {(!currentYearId || (loading && !data)) ? (
        <div style={{ padding: '60px 0' }}>
          <Loader fullScreen={false} size="md" text="Loading income & expense statement..." />
        </div>
      ) : (
        <>
          {/* ── 3 Summary KPI Cards ── */}
          <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#ecfdf5', color: '#059669' }}>
            <i className="fa-solid fa-arrow-trend-up" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Gross Inflow / Receipts</div>
            <div className={styles.statPillVal} style={{ color: '#059669' }}>
              {typeof data?.summary?.total_income === 'number' ? fmt(data.summary.total_income) : (data?.summary?.total_income ?? fmt(0))}
            </div>
          </div>
        </div>

        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#fef2f2', color: '#dc2626' }}>
            <i className="fa-solid fa-arrow-trend-down" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Gross Outflow / Expenses</div>
            <div className={styles.statPillVal} style={{ color: '#dc2626' }}>
              {typeof data?.summary?.total_expense === 'number' ? fmt(data.summary.total_expense) : (data?.summary?.total_expense ?? fmt(0))}
            </div>
          </div>
        </div>

        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#f0fdfa', color: '#0d9488' }}>
            <i className="fa-solid fa-scale-balanced" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Net Institutional Surplus</div>
            <div className={styles.statPillVal} style={{ color: '#0d9488' }}>
              {typeof data?.summary?.net_balance === 'number' ? fmt(data.summary.net_balance) : (data?.summary?.net_balance ?? fmt(0))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue & Expense Category Visual Breakdown ── */}
      {(incomeCats.length > 0 || expenseCats.length > 0) && (
        <div className={styles.breakdownGrid}>
          
          {/* Income Sources */}
          <div className={styles.breakdownCard}>
            <h2 className={styles.breakdownTitle}>
              <i className="fa-solid fa-circle-arrow-down" style={{ color: '#059669' }} />
              Income Streams Distribution
            </h2>
            <div className={styles.categoryList}>
              {incomeCats.map(cat => (
                <div key={cat.name} className={styles.categoryItem}>
                  <div className={styles.categoryTop}>
                    <span>{cat.name}</span>
                    <span>{typeof cat.amount === 'number' ? fmt(cat.amount) : cat.amount} ({cat.percent}%)</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBar} style={{ width: `${Math.min(100, Math.max(0, cat.percent))}%`, background: '#059669' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Outflows */}
          <div className={styles.breakdownCard}>
            <h2 className={styles.breakdownTitle}>
              <i className="fa-solid fa-circle-arrow-up" style={{ color: '#dc2626' }} />
              Expenditure Outflows Distribution
            </h2>
            <div className={styles.categoryList}>
              {expenseCats.map(cat => (
                <div key={cat.name} className={styles.categoryItem}>
                  <div className={styles.categoryTop}>
                    <span>{cat.name}</span>
                    <span>{typeof cat.amount === 'number' ? fmt(cat.amount) : cat.amount} ({cat.percent}%)</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBar} style={{ width: `${Math.min(100, Math.max(0, cat.percent))}%`, background: '#dc2626' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── Monthly Breakdown Ledger Table ── */}
      <div className={styles.tableCard}>
        {loading && !data ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader fullScreen={false} size="md" text="Loading ledger history..." />
          </div>
        ) : months.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 28, color: '#94a3b8', marginBottom: 10, display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>No income or expense records found for this academic session.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Billing Month</th>
                  <th>Total Inflow (Receipts)</th>
                  <th>Total Outflow (Disbursements)</th>
                  <th>Net Monthly Cashflow</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td><strong>{m.month}</strong></td>
                    <td style={{ color: '#059669' }}><strong>{typeof m.income === 'number' ? fmt(m.income) : m.income}</strong></td>
                    <td style={{ color: '#dc2626' }}><strong>{typeof m.expense === 'number' ? fmt(m.expense) : m.expense}</strong></td>
                    <td><strong>{typeof m.net === 'number' ? fmt(m.net) : m.net}</strong></td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 800,
                          background: m.trend === 'up' ? '#dcfce7' : '#fee2e2',
                          color: m.trend === 'up' ? '#15803d' : '#b91c1c',
                        }}
                      >
                        <i className={`fa-solid fa-arrow-trend-${m.trend === 'up' ? 'up' : 'down'}`} />
                        {m.trend === 'up' ? 'Surplus' : 'Deficit'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

    </div>
  );
}
