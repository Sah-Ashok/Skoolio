'use client';

import Sidebar from "@/components/shared/Sidebar";
import RequireRole from "@/components/shared/RequireRole";
import AppFooter from "@/components/shared/AppFooter";
import OfflineGuard from "@/components/shared/OfflineGuard";
import FeedbackWidget from "@/components/shared/FeedbackWidget";
import { useApi } from "@/lib/useApi";
import { useAppSelector } from "@/store/hooks";
import Loader from "@/components/shared/Loader";
import Link from "next/link";
import styles from "@/components/shared/no-active-year.module.css";

function FinancePlanGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAppSelector((s) => s.auth);
  const { data: status, loading } = useApi<any>("/subscriptions/me/status");

  if (loading && !status) {
    return <Loader fullScreen={false} size="md" text="Checking plan permissions..." />;
  }

  const planName = status?.plan?.name?.toLowerCase() || '';
  // Finance role is exclusive to Plus and Ultra plans (not Pro)
  const isProPlan = planName.includes('pro') && !planName.includes('plus') && !planName.includes('ultra');

  if (status && isProPlan) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.iconWrap} style={{ background: '#fef3c7', color: '#d97706' }}>
            <i className="fa-solid fa-crown" />
          </div>
          <h2 className={styles.title}>Plus &amp; Ultra Plan Feature</h2>
          <p className={styles.desc}>
            The dedicated Finance Portal is an exclusive feature available on <strong>Plus</strong> and <strong>Ultra</strong> plans. Your school is currently on the <strong>{status.plan?.name || 'Pro'}</strong> plan.
          </p>

          {user?.role === 'admin' || user?.role === 'super_admin' ? (
            <Link href="/upgrade" className={styles.btn} style={{ background: 'linear-gradient(135deg, #ff5e1e, #ff8c42)' }}>
              <i className="fa-solid fa-arrow-up-right-from-square" /> Upgrade to Plus / Ultra
            </Link>
          ) : (
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>
              Please contact your school administrator to upgrade the subscription plan.
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['finance', 'admin', 'super_admin']}>
      <div className="app-shell">
        <Sidebar role="finance" />
        <div className="app-main">
          <div className="app-page">
            <OfflineGuard>
              <FinancePlanGuard>
                {children}
              </FinancePlanGuard>
            </OfflineGuard>
          </div>
          <AppFooter role="finance" />
        </div>
      </div>
      <FeedbackWidget />
    </RequireRole>
  );
}
