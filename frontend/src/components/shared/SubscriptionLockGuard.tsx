'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApi } from '@/lib/useApi';
import { useAppSelector } from '@/store/hooks';
import Loader from '@/components/shared/Loader';
import styles from './no-active-year.module.css';

const ADMIN_SUBSCRIPTION_BYPASS_PATHS = ['/upgrade', '/subscription', '/settings'];

export default function SubscriptionLockGuard({
  children,
  role = 'admin',
}: {
  children: React.ReactNode;
  role?: 'admin' | 'teacher' | 'student';
}) {
  const { data: status, loading } = useApi<any>(role === 'admin' ? '/subscriptions/me/status' : '');
  const authBootstrapped = useAppSelector((s) => s.auth.bootstrapped);
  const pathname = usePathname();

  // If on bypass paths, allow access immediately
  if (role === 'admin' && ADMIN_SUBSCRIPTION_BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // While loading or not yet bootstrapped, render a neutral placeholder to avoid content flash
  if (!authBootstrapped || (loading && !status)) {
    return <Loader fullScreen={false} size="md" text="Checking subscription..." />;
  }

  // If no status or active or in grace period, render children normally
  if (!status || status.is_in_grace_period || status.subscription?.status !== 'expired') {
    return <>{children}</>;
  }

  // If admin is on /upgrade, /subscription, or /settings, allow access so they can renew
  if (role === 'admin' && ADMIN_SUBSCRIPTION_BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrap} style={{ background: '#fee2e2', color: '#ef4444' }}>
          <i className="fa-solid fa-lock" />
        </div>
        <h2 className={styles.title}>Subscription Expired</h2>
        <p className={styles.desc}>
          {role === 'admin'
            ? `Your school's ${status.plan?.name || ''} plan subscription has expired and the grace period has ended. Please renew or upgrade your plan to unlock access.`
            : 'Your school subscription has expired. Please contact your school administrator to renew access.'}
        </p>

        {role === 'admin' && (
          <Link href="/upgrade" className={styles.btn}>
            <i className="fa-solid fa-bolt" /> Renew / Upgrade Plan
          </Link>
        )}
      </div>
    </div>
  );
}
