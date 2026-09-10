'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/lib/useApi';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useCurrency } from '@/lib/useCurrency';
import Loader from '@/components/shared/Loader';
import styles from './fees-report.module.css';

interface ClassReportItem {
  class_name: string;
  expected: number | string;
  collected: number | string;
  outstanding: number | string;
  rate: string;
  defaulters: number;
}

interface FeeTypeReportItem {
  fee_type: string;
  total_students: number;
  collected: number | string;
  outstanding: number | string;
}

export default function FinanceFeeReportPage() {
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
      total_expected?: number;
      total_collected?: number;
      total_outstanding?: number;
      collection_rate?: number;
    };
    class_wise?: ClassReportItem[];
    type_wise?: FeeTypeReportItem[];
  }>(currentYearId ? `/finance/reports/fees?academic_year_id=${currentYearId}` : '');

  const classList = data?.class_wise || [];
  const typeList = data?.type_wise || [];
  const overallRate = data?.summary?.collection_rate ?? 0;

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
            <i className="fa-solid fa-download" /> Export Report
          </button>
        </div>
      </div>

      {(!currentYearId || (loading && !data)) ? (
        <div style={{ padding: '60px 0' }}>
          <Loader fullScreen={false} size="md" text="Generating financial statement..." />
        </div>
      ) : (
        <>
          {/* ── 4 KPI Stats ── */}
          <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>
            <i className="fa-solid fa-bullseye" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Gross Expected Receivables</div>
            <div className={styles.statPillVal}>{fmt(data?.summary?.total_expected ?? 0)}</div>
          </div>
        </div>

        <div className={styles.statPill}>
          <div className={styles.statPillIcon} style={{ background: '#ecfdf5', color: '#059669' }}>
            <i className="fa-solid fa-sack-dollar" />
          </div>
          <div>
            <div className={styles.statPillLabel}>Total Recovered / Collected</div>
            <div className={styles.statPillVal} style={{ color: '#059669' }}>
              {fmt(data?.summary?.total_collected ?? 0)}
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
              {fmt(data?.summary?.total_outstanding ?? 0)}
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
          <div className={styles.rateBar} style={{ width: `${Math.min(100, Math.max(0, overallRate))}%` }} />
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
        ) : classList.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-solid fa-folder-open" style={{ fontSize: 28, color: '#94a3b8', marginBottom: 10, display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>No class-wise records found for this academic session.</p>
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
                    <td>{typeof c.expected === 'number' ? fmt(c.expected) : c.expected}</td>
                    <td style={{ color: '#059669' }}><strong>{typeof c.collected === 'number' ? fmt(c.collected) : c.collected}</strong></td>
                    <td style={{ color: '#dc2626' }}><strong>{typeof c.outstanding === 'number' ? fmt(c.outstanding) : c.outstanding}</strong></td>
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
        {typeList.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-solid fa-layer-group" style={{ fontSize: 28, color: '#94a3b8', marginBottom: 10, display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>No fee head category records recorded yet.</p>
          </div>
        ) : (
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
                    <td style={{ color: '#059669' }}><strong>{typeof t.collected === 'number' ? fmt(t.collected) : t.collected}</strong></td>
                    <td style={{ color: '#dc2626' }}><strong>{typeof t.outstanding === 'number' ? fmt(t.outstanding) : t.outstanding}</strong></td>
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
