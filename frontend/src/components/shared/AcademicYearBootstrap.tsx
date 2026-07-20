'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchActiveAcademicYear, clearAcademicYear } from '@/store/academicYearSlice';

/**
 * AcademicYearBootstrap
 *
 * Fetches the active academic year once, right after auth bootstraps and a
 * user is confirmed logged in. Works for all roles — backend resolves
 * school_id from the JWT.
 *
 * Also clears the cached year on logout so the next login gets a fresh fetch.
 */
export default function AcademicYearBootstrap() {
  const dispatch       = useAppDispatch();
  const bootstrapped   = useAppSelector((s) => s.auth.bootstrapped);
  const user           = useAppSelector((s) => s.auth.user);
  const ayBootstrapped = useAppSelector((s) => s.academicYear.bootstrapped);

  useEffect(() => {
    if (!bootstrapped) return;

    if (!user) {
      // User logged out — clear so next login fetches fresh
      dispatch(clearAcademicYear());
      return;
    }

    // User is logged in and we haven't fetched yet
    if (!ayBootstrapped) {
      dispatch(fetchActiveAcademicYear());
    }
  }, [bootstrapped, user, ayBootstrapped, dispatch]);

  return null;
}
