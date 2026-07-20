'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useAppSelector } from '@/store/hooks';
import styles from './no-active-year.module.css';

/**
 * NoActiveYearGuard
 *
 * Placed inside each role layout wrapping {children}.
 * - While loading → renders children (auth spinner already handles this)
 * - bootstrapped + no activeYear → shows "No active academic year" page
 * - bootstrapped + activeYear exists → renders children normally
 *
 * Super-admin is excluded — they manage academic years so must always see content.
 * Admin can always reach /academic-years and /settings even without an active year.
 */

// Pages the admin must always access even without an active academic year
const ADMIN_BYPASS_PATHS = ['/academic-years', '/settings', '/subscription'];

export default function NoActiveYearGuard({
  children,
  role = 'admin',
}: {
  children: React.ReactNode;
  role?: 'admin' | 'teacher' | 'student';
}) {
  const { activeYear, bootstrapped, loading } = useAcademicYear();
  const authBootstrapped = useAppSelector((s) => s.auth.bootstrapped);
  const pathname = usePathname();

  // While auth or academic year is still loading — show children (avoid flash)
  if (!authBootstrapped || loading || !bootstrapped) return <>{children}</>;

  // Active year exists — all good
  if (activeYear) return <>{children}</>;

  // Admin is on a page they must always be able to reach (e.g. to create a year)
  if (role === 'admin' && ADMIN_BYPASS_PATHS.some(p => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // No active year set
  const roleMessages: Record<string, string> = {
    admin:   'Please go to Academic Years and set one year as active to continue.',
    teacher: 'Please contact your school administrator to set an active academic year.',
    student: 'Please contact your school administrator to set an active academic year.',
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <i className="fa-solid fa-calendar-xmark" />
        </div>
        <h2 className={styles.title}>No Active Academic Year</h2>
        <p className={styles.desc}>{roleMessages[role]}</p>

        {role === 'admin' && (
          <Link href="/academic-years" className={styles.btn}>
            <i className="fa-solid fa-arrow-right" /> Go to Academic Years
          </Link>
        )}
      </div>
    </div>
  );
}
