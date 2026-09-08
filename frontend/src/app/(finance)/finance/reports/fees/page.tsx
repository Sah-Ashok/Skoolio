'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import Loader from '@/components/shared/Loader';
import styles from './fees-report.module.css';

interface ClassReportItem {
  class_name: string;
  expected: string;
  collected: string;
  outstanding: string;
  rate: string;
  defaulters: number;
}

interface FeeTypeReportItem {
  fee_type: string;
  total_students: number;
  collected: string;
  outstanding: string;
}

export default function FinanceFeeReportPage() {
  const [selectedSession, setSelectedSession] = useState('2026-2027');

  const { data, loading } = useApi<{
    summary?: {
      total_expected?: string;
      total_collected?: string;
      total_outstanding?: string;
      collection_rate?: number;
    };
    class_wise?: ClassReportItem[];
    type_wise?: FeeTypeReportItem[];
  }>(`/finance/reports/fees?session=${selectedSession}`);

  const defaultClasses: ClassReportItem[] = [
    { class_name: 'Class 10', expected: '₹ 4,08,000', collected: '₹ 3,74,000', outstanding: '₹ 34,000', rate: '91.7%', defaulters: 4 },
    { class_name: 'Class 9', expected: '₹ 3,58,800', collected: '₹ 3,12,000', outstanding: '₹ 46,800', rate: '87.0%', defaulters: 6 },
    { class_name: 'Class 8', expected: '₹ 2,72,800', collected: '₹ 2,48,000', outstanding: '₹ 24,800', rate: '90.9%', defaulters: 3 },
    { class_name: 'Class 7', expected: '₹ 2,52,000', collected: '₹ 2,10,000', outstanding: '₹ 42,000', rate: '83.3%', defaulters: 7 },
    { class_name: 'Class 6', expected: '₹ 2,11,680', collected: '₹ 1,94,400', outstanding: '₹ 17,280', rate: '91.8%', defaulters: 2 },
    { class_name: 'Class 11', expected: '₹ 4,08,000', collected: '₹ 3,36,000', outstanding: '₹ 72,000', rate: '82.4%', defaulters: 8 },
    { class_name: 'Class 12', expected: '₹ 3,84,000', collected: '₹ 3,48,000', outstanding: '₹ 36,000', rate: '90.6%', defaulters: 4 },
  ];

  const defaultFeeTypes: FeeTypeReportItem[] = [
    { fee_type: 'Tuition Fee (Quarterly)', total_students: 708, collected: '₹ 16,80,000', outstanding: '₹ 1,84,000' },
    { fee_type: 'Annual Development / Admission', total_students: 142, collected: '₹ 3,50,000', outstanding: '₹ 25,000' },
    { fee_type: 'Bus / Fleet Transport Fee', total_students: 280, collected: '₹ 1,80,000', outstanding: '₹ 32,000' },
    { fee_type: 'Board & Examination Fees', total_students: 708, collected: '₹ 76,000', outstanding: '₹ 12,000' },
  ];

  const classList = data?.class_wise && data.class_wise.length > 0 ? data.class_wise : defaultClasses;
  const typeList = data?.type_wise && data.type_wise.length > 0 ? data.type_wise : defaultFeeTypes;
  const overallRate = data?.summary?.collection_rate ?? 88.6;

  return (
    <div className={styles.pageWrap}>

      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Institutional Fee Collection Audit</h1>
          <p className={styles.subtitle}>Detailed recovery rate metrics, class-wise receivables, and fee head analytics</p>
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
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
          >
            <option value="2026-2027">Session 2026 - 2027</option>
            <option value="2025-2026">Session 2025 - 2026</option>
          </select>

          <button
            className={styles.exportBtn}
            onClick={() => window.print()}
          >
            <i className="fa-solid fa-download" /> Export Report
          </button>
        </div>
      </div>

      {/* ── 4 KPI Stats ── */}
      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>
            <i className="fa-solid fa-bullseye" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Gross Expected Receivables</div>
            <div className={styles.statPillVal}>{data?.summary?.total_expected ?? '₹ 22,94,480'}</div>
          </div>
        </div>

        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#ecfdf5', color: '#059669' }}>
            <i className="fa-solid fa-sack-dollar" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Total Recovered / Collected</div>
            <div className={styles.statPillVal} style={{ color: '#059669' }}>
              {data?.summary?.total_collected ?? '₹ 20,32,400'}
            </div>
          </div>
        </div>

        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#fef2f2', color: '#dc2626' }}>
            <i className="fa-solid fa-clock-rotate-left" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Overdue Uncollected Balance</div>
            <div className={styles.statPillVal} style={{ color: '#dc2626' }}>
              {data?.summary?.total_outstanding ?? '₹ 2,62,080'}
            </div>
          </div>
        </div>

        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#fffbeb', color: '#d97706' }}>
            <i className="fa-solid fa-percent" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Overall Recovery Rate</div>
            <div className={styles.statPillVal} style={{ color: '#d97706' }}>
              {overallRate}%
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Recovery Rate Progress Card ── */}
      <div className={styles.rateCard}>
        <div className={styles.rateCardHeader}>
          <span className={styles.rateTitle}>Session Fee Recovery Completion</span>
          <span className={styles.ratePercentage}>{overallRate}% Recovered</span>
        </div>
        <div className={styles.rateTrack}>
          <div className={styles.rateBar} style={{ width: `${overallRate}%` }} />
        </div>
      </div>

      {/* ── Class-wise Breakdown Table ── */}
      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <h2 className={styles.cardTitle}>Class &amp; Grade Recovery Analysis</h2>
        </div>
        {loading && !data ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader fullScreen={false} size="md" text="Loading class-wise recovery..." />
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Class / Grade</th>
                  <th>Expected</th>
                  <th>Collected</th>
                  <th>Overdue Balance</th>
                  <th>Recovery Rate</th>
                  <th>Defaulters</th>
                </tr>
              </thead>
              <tbody>
                {classList.map((c) => (
                  <tr key={c.class_name}>
                    <td><strong>{c.class_name}</strong></td>
                    <td>{c.expected}</td>
                    <td style={{ color: '#059669' }}><strong>{c.collected}</strong></td>
                    <td style={{ color: '#dc2626' }}><strong>{c.outstanding}</strong></td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          background: parseFloat(c.rate) >= 90 ? '#dcfce7' : '#fef3c7',
                          color: parseFloat(c.rate) >= 90 ? '#15803d' : '#b45309',
                        }}
                      >
                        {c.rate}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: c.defaulters > 5 ? '#dc2626' : '#64748b',
                          fontWeight: 700,
                        }}
                      >
                        {c.defaulters} Students
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Fee Head Category Breakdown ── */}
      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <h2 className={styles.cardTitle}>Fee Head Category Ledger</h2>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fee Head Category</th>
                <th>Enrolled Students</th>
                <th>Collected Amount</th>
                <th>Overdue Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {typeList.map((t) => (
                <tr key={t.fee_type}>
                  <td><strong>{t.fee_type}</strong></td>
                  <td>{t.total_students} Students</td>
                  <td style={{ color: '#059669' }}><strong>{t.collected}</strong></td>
                  <td style={{ color: '#dc2626' }}><strong>{t.outstanding}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
