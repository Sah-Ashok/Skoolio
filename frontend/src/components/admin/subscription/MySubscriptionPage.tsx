"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const statusBadgeStyle: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#15803d' },
  grace_period: { bg: '#fef3c7', color: '#b45309' },
  expired: { bg: '#ffe4e6', color: '#be123c' },
  cancelled: { bg: '#ffe4e6', color: '#be123c' },
};

const ProgressBar = ({ value, max }: { value: number; max: number | null }) => {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isNearLimit = max ? value / max >= 0.8 : false;
  return (
    <div style={{ height: '8px', borderRadius: '999px', background: '#eaecef', overflow: 'hidden', marginTop: '8px' }}>
      <div style={{ height: '100%', width: max ? `${pct}%` : '6%', background: isNearLimit ? '#ef4444' : 'linear-gradient(90deg, #ff9b51, #14b8a6)', borderRadius: 'inherit' }} />
    </div>
  );
};

export default function MySubscriptionPage() {
  const { data: status, loading: statusLoading } = useApi<any>('/subscriptions/me/status');
  const { data: history, loading: historyLoading } = useApi<any[]>('/subscriptions/me/history');

  const sub = status?.subscription;
  const plan = status?.plan;
  const badge = statusBadgeStyle[sub?.status] || statusBadgeStyle.active;

  return (
    <div className="main-wrapper">
      <Topbar title="My Subscription" subtitle="Your current plan, usage, and billing history" />
      <main className="page-content">
        {statusLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            <section className="card" style={{ marginBottom: '20px', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #25343F, #314653)', color: '#fff', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: '#FF9B51', marginBottom: '6px' }}>CURRENT PLAN</p>
                    <h1 style={{ fontSize: '28px', fontWeight: 800 }}>{plan?.name}</h1>
                  </div>
                  <span style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, textTransform: 'capitalize', background: badge.bg, color: badge.color }}>
                    {sub?.status?.replace('_', ' ')}
                  </span>
                </div>

                {status?.is_in_grace_period && (
                  <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ color: '#FF9B51' }} />
                    <span style={{ fontSize: '13px' }}>
                      Your plan expired. <strong>{status.days_until_lock} day{status.days_until_lock === 1 ? '' : 's'}</strong> left before downgrade to Free.
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: '#bfc9d1' }}>Billing Cycle</p>
                    <strong style={{ textTransform: 'capitalize' }}>{sub?.billing_cycle}</strong>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#bfc9d1' }}>Started</p>
                    <strong>{sub?.start_date ? new Date(sub.start_date).toLocaleDateString() : '-'}</strong>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#bfc9d1' }}>Expires</p>
                    <strong>{sub?.end_date ? new Date(sub.end_date).toLocaleDateString() : 'Never (Free)'}</strong>
                  </div>
                  {Number(sub?.amount_paid) > 0 && (
                    <div>
                      <p style={{ fontSize: '11px', color: '#bfc9d1' }}>Amount Paid</p>
                      <strong>{sub.currency} {sub.amount_paid}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-body">
                <Link className="btn btn-primary" href="/upgrade" style={{ display: 'inline-flex' }}>
                  <i className="fa-solid fa-rocket" /> {plan?.name === 'Plus' ? 'View Plans' : 'Upgrade Plan'}
                </Link>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div className="card">
                <div className="card-body">
                  <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>STUDENTS</p>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
                    {status?.student_count} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>/ {plan?.max_students ?? '\u221e'}</span>
                  </h3>
                  <ProgressBar value={status?.student_count || 0} max={plan?.max_students} />
                  {!status?.can_add_student && (
                    <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', fontWeight: 700 }}>Limit reached \u2014 upgrade to add more</p>
                  )}
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>TEACHERS</p>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>
                    {status?.teacher_count} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>/ {plan?.max_teachers ?? '\u221e'}</span>
                  </h3>
                  <ProgressBar value={status?.teacher_count || 0} max={plan?.max_teachers} />
                  {!status?.can_add_teacher && (
                    <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', fontWeight: 700 }}>Limit reached \u2014 upgrade to add more</p>
                  )}
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>FEE MANAGEMENT</p>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', color: plan?.fee_management_enabled ? '#15803d' : '#be123c' }}>
                    {plan?.fee_management_enabled ? 'Enabled' : 'Locked'}
                  </h3>
                  {!plan?.fee_management_enabled && (
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>Upgrade to Pro or Plus to unlock fee collection</p>
                  )}
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h3>Billing History</h3></div>
              <div className="table-wrapper">
                {historyLoading ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}><Spinner size={24} /></div>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Plan</th><th>Billing Cycle</th><th>Amount Paid</th><th>Period</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {(history || []).map((h) => (
                        <tr key={h.id}>
                          <td><strong>{h.plan_name}</strong></td>
                          <td style={{ textTransform: 'capitalize' }}>{h.billing_cycle}</td>
                          <td>{Number(h.amount_paid) > 0 ? `${h.currency} ${h.amount_paid}` : 'Free'}</td>
                          <td>
                            {new Date(h.start_date).toLocaleDateString()}
                            {h.end_date ? ` \u2192 ${new Date(h.end_date).toLocaleDateString()}` : ' (ongoing)'}
                          </td>
                          <td>
                            <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, textTransform: 'capitalize', ...(statusBadgeStyle[h.status] || statusBadgeStyle.active) }}>
                              {h.status?.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!history || history.length === 0) && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No billing history yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
