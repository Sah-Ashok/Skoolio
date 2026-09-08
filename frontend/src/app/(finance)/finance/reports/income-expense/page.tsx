'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import Loader from '@/components/shared/Loader';
import styles from './report.module.css';

interface MonthlyReportRow {
  month: string;
  income: string;
  expense: string;
  net: string;
  trend: 'up' | 'down';
}

export default function FinanceIncomeExpenseReportPage() {
  const [yearFilter, setYearFilter] = useState('2026');

  const { data, loading } = useApi<{
    summary?: {
      total_income?: string;
      total_expense?: string;
      net_balance?: string;
      is_surplus?: boolean;
    };
    months?: MonthlyReportRow[];
  }>(`/finance/reports/income-expense?year=${yearFilter}`);

  const defaultMonths: MonthlyReportRow[] = [
    { month: 'August 2026', income: '₹ 5,84,000', expense: '₹ 2,12,000', net: '+ ₹ 3,72,000', trend: 'up' },
    { month: 'July 2026', income: '₹ 6,10,000', expense: '₹ 2,45,000', net: '+ ₹ 3,65,000', trend: 'up' },
    { month: 'June 2026', income: '₹ 4,92,000', expense: '₹ 2,30,000', net: '+ ₹ 2,62,000', trend: 'up' },
    { month: 'May 2026', income: '₹ 3,20,000', expense: '₹ 1,95,000', net: '+ ₹ 1,25,000', trend: 'down' },
    { month: 'April 2026 (New Session)', income: '₹ 8,40,000', expense: '₹ 3,10,000', net: '+ ₹ 5,30,000', trend: 'up' },
  ];

  const months = data?.months && data.months.length > 0 ? data.months : defaultMonths;

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
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="2026">Financial Year 2026 - 2027</option>
            <option value="2025">Financial Year 2025 - 2026</option>
          </select>

          <button
            className={styles.exportBtn}
            onClick={() => window.print()}
          >
            <i className="fa-solid fa-print" /> Print Statement
          </button>
        </div>
      </div>

      {/* ── 3 Summary KPI Cards ── */}
      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#ecfdf5', color: '#059669' }}>
            <i className="fa-solid fa-arrow-trend-up" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Gross Inflow / Receipts</div>
            <div className={styles.statPillVal} style={{ color: '#059669' }}>
              {data?.summary?.total_income ?? '₹ 28,46,000'}
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
              {data?.summary?.total_expense ?? '₹ 11,92,000'}
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
              {data?.summary?.net_balance ?? '+ ₹ 16,54,000'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue & Expense Category Visual Breakdown ── */}
      <div className={styles.breakdownGrid}>
        
        {/* Income Sources */}
        <div className={styles.breakdownCard}>
          <h2 className={styles.breakdownTitle}>
            <i className="fa-solid fa-circle-arrow-down" style={{ color: '#059669' }} />
            Income Streams Distribution
          </h2>
          <div className={styles.categoryList}>
            <div className={styles.categoryItem}>
              <div className={styles.categoryTop}>
                <span>Tuition Fees</span>
                <span>₹ 22,40,000 (78.7%)</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: '78.7%', background: '#059669' }} />
              </div>
            </div>

            <div className={styles.categoryItem}>
              <div className={styles.categoryTop}>
                <span>Admission &amp; Reg. Fees</span>
                <span>₹ 3,50,000 (12.3%)</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: '12.3%', background: '#10b981' }} />
              </div>
            </div>

            <div className={styles.categoryItem}>
              <div className={styles.categoryTop}>
                <span>Transport Services</span>
                <span>₹ 1,80,000 (6.3%)</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: '6.3%', background: '#34d399' }} />
              </div>
            </div>

            <div className={styles.categoryItem}>
              <div className={styles.categoryTop}>
                <span>Examination &amp; Others</span>
                <span>₹ 76,000 (2.7%)</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: '2.7%', background: '#6ee7b7' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Expense Outflows */}
        <div className={styles.breakdownCard}>
          <h2 className={styles.breakdownTitle}>
            <i className="fa-solid fa-circle-arrow-up" style={{ color: '#dc2626' }} />
            Expenditure Outflows Distribution
          </h2>
          <div className={styles.categoryList}>
            <div className={styles.categoryItem}>
              <div className={styles.categoryTop}>
                <span>Staff &amp; Faculty Compensation</span>
                <span>₹ 8,42,000 (70.6%)</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: '70.6%', background: '#dc2626' }} />
              </div>
            </div>

            <div className={styles.categoryItem}>
              <div className={styles.categoryTop}>
                <span>Campus Utilities &amp; Tech</span>
                <span>₹ 1,56,000 (13.1%)</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: '13.1%', background: '#f87171' }} />
              </div>
            </div>

            <div className={styles.categoryItem}>
              <div className={styles.categoryTop}>
                <span>Supplies &amp; Lab Materials</span>
                <span>₹ 1,14,000 (9.6%)</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: '9.6%', background: '#fb923c' }} />
              </div>
            </div>

            <div className={styles.categoryItem}>
              <div className={styles.categoryTop}>
                <span>Estate Maintenance &amp; Repairs</span>
                <span>₹ 80,000 (6.7%)</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: '6.7%', background: '#fbbf24' }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Monthly Breakdown Ledger Table ── */}
      <div className={styles.tableCard}>
        {loading && !data ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader fullScreen={false} size="md" text="Loading ledger history..." />
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
                    <td style={{ color: '#059669' }}><strong>{m.income}</strong></td>
                    <td style={{ color: '#dc2626' }}><strong>{m.expense}</strong></td>
                    <td><strong>{m.net}</strong></td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          background: m.trend === 'up' ? '#dcfce7' : '#fee2e2',
                          color: m.trend === 'up' ? '#15803d' : '#b91c1c',
                        }}
                      >
                        <i className={`fa-solid fa-arrow-${m.trend}`} />
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

    </div>
  );
}
