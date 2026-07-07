"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useState } from "react";
import { useAppSelector } from "@/store/hooks";

// P5 fix: derive currency from the school's country stored in Redux auth store.
// Previously this was hardcoded to 'Nepal' so all schools saw NPR regardless.
const formatPrice = (plan: any, country: string, cycle: 'monthly' | 'yearly') => {
  const isIndia = country === 'India';
  const key = `price_${isIndia ? 'inr' : 'npr'}_${cycle}` as const;
  const symbol = isIndia ? '\u20b9' : 'NPR ';
  return `${symbol}${Number(plan[key]).toLocaleString()}`;
};

export default function UpgradePlanPage() {
  const { data: status, loading: statusLoading } = useApi<any>('/subscriptions/me/status');
  const { data: plans, loading: plansLoading } = useApi<any[]>('/subscriptions/plans');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  // P5 fix: read country from Redux — falls back to 'Nepal' if not set
  const country = useAppSelector((state) => state.auth.user?.country ?? 'Nepal');

  const currentPlanName = status?.plan?.name;

  return (
    <div className="main-wrapper">
      <Topbar title="Upgrade Plan" subtitle="Choose the plan that fits your school" />
      <main className="page-content">
        {statusLoading || plansLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            {status && (
              <section className="card" style={{ marginBottom: '20px' }}>
                <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>CURRENT PLAN</p>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>{currentPlanName}</h2>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b' }}>Students</p>
                      <strong>{status.student_count} / {status.plan.max_students ?? '\u221e'}</strong>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b' }}>Teachers</p>
                      <strong>{status.teacher_count} / {status.plan.max_teachers ?? '\u221e'}</strong>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b' }}>Fee Management</p>
                      <strong>{status.plan.fee_management_enabled ? 'Enabled' : 'Locked'}</strong>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                <button
                  onClick={() => setCycle('monthly')}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: cycle === 'monthly' ? '#fff' : 'transparent', boxShadow: cycle === 'monthly' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCycle('yearly')}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: cycle === 'yearly' ? '#fff' : 'transparent', boxShadow: cycle === 'yearly' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
                >
                  Yearly <span style={{ color: '#16a34a', marginLeft: '4px' }}>Save</span>
                </button>
              </div>
            </div>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              {plans?.map((plan) => {
                const isCurrent = plan.name === currentPlanName;
                const isFeatured = plan.name === 'Pro';
                // P5 fix: use real country from Redux instead of hardcoded 'Nepal'
                const otherCountry = country === 'India' ? 'Nepal' : 'India';
                return (
                  <article
                    key={plan.id}
                    style={{
                      borderRadius: '16px',
                      padding: '28px 24px',
                      border: isFeatured ? '2px solid #FF9B51' : '1px solid #e2e8f0',
                      background: isFeatured ? 'linear-gradient(145deg, #25343F, #1a2630)' : '#fff',
                      color: isFeatured ? '#EAEFEF' : '#1e293b',
                      boxShadow: isFeatured ? '0 8px 28px rgba(37,52,63,0.28)' : '0 2px 12px rgba(37,52,63,0.07)',
                      position: 'relative',
                    }}
                  >
                    {isFeatured && (
                      <span style={{ position: 'absolute', top: '-12px', right: '20px', background: '#FF9B51', color: '#25343F', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                        MOST POPULAR
                      </span>
                    )}
                    <p style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: isFeatured ? '#FF9B51' : '#94a3b8', marginBottom: '6px' }}>
                      {plan.name.toUpperCase()}
                    </p>
                    <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>
                      {plan.name === 'Free' ? 'Free' : formatPrice(plan, country, cycle)}
                      {plan.name !== 'Free' && <span style={{ fontSize: '13px', fontWeight: 500, opacity: 0.7 }}>/{cycle === 'monthly' ? 'mo' : 'yr'}</span>}
                    </h2>
                    <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '16px' }}>
                      {plan.name !== 'Free' && `Also available: ${formatPrice(plan, otherCountry, cycle)} for ${otherCountry}`}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                      <Feature isFeatured={isFeatured} text={`Up to ${plan.max_students ?? 'unlimited'} students`} />
                      <Feature isFeatured={isFeatured} text={`Up to ${plan.max_teachers ?? 'unlimited'} teachers`} />
                      <Feature isFeatured={isFeatured} text={plan.fee_management_enabled ? 'Fee Management included' : 'Fee Management locked'} muted={!plan.fee_management_enabled} />
                      <Feature isFeatured={isFeatured} text="Attendance, Exams, Calendar included" />
                    </div>

                    {isCurrent ? (
                      <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: isFeatured ? 'rgba(255,255,255,0.1)' : '#f1f5f9', fontWeight: 700, fontSize: '13px' }}>
                        Your Current Plan
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: isFeatured ? '#FF9B51' : '#25343F', color: isFeatured ? '#25343F' : '#FF9B51', fontWeight: 800, fontSize: '13px' }}>
                        Contact us to upgrade
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#64748b' }}>
              To upgrade or renew your plan, please contact your CampusPOS account manager with your payment details.
              Online self-checkout is coming soon.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Feature({ text, isFeatured, muted }: { text: string; isFeatured: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', opacity: muted ? 0.5 : 1 }}>
      <i className={`fa-solid ${muted ? 'fa-xmark' : 'fa-check'}`} style={{ color: muted ? '#ef4444' : (isFeatured ? '#FF9B51' : '#16a34a'), fontSize: '12px' }} />
      <span>{text}</span>
    </div>
  );
}
