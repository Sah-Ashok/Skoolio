'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { AllRoles } from '@/store/authSlice';
import Loader from '@/components/shared/Loader';

interface RequireRoleProps {
  allow: AllRoles[];
  children: React.ReactNode;
}

/**
 * Client-side route guard. Waits for the auth bootstrap (/auth/me) to finish,
 * then redirects to /login if the user isn't logged in or doesn't have one
 * of the allowed roles for this route group.
 */
export default function RequireRole({ allow, children }: RequireRoleProps) {
  const { user, bootstrapped } = useAppSelector((s) => s.auth);
  const router = useRouter();

  useEffect(() => {
    if (!bootstrapped) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!allow.includes(user.role)) {
      // Logged in, but wrong role for this section — send them to their own area
      const fallback =
        user.role === 'admin' || user.role === 'super_admin' ? '/dashboard' :
        user.role === 'faculty'  ? '/teacher/dashboard' :
        user.role === 'finance'  ? '/finance/dashboard' :
        '/student/dashboard';
      router.replace(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, user]);

  if (!bootstrapped || !user || !allow.includes(user.role)) {
    return <Loader text="Verifying session..." />;
  }

  return <>{children}</>;
}
