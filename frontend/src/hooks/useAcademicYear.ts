'use client';

import { useAppSelector } from '@/store/hooks';
import type { AcademicYear } from '@/store/academicYearSlice';

export interface UseAcademicYearResult {
  /** The active academic year, or null if none is set */
  activeYear:    AcademicYear | null;
  /** The active year's id — shorthand for activeYear?.id */
  academicYearId: number | null;
  /** True while the first fetch is in progress */
  loading:       boolean;
  /** True once the fetch has completed (success or fail) */
  bootstrapped:  boolean;
  /** Error message if no active year was found */
  error:         string | null;
  /** True if there is a valid active year ready to use */
  isReady:       boolean;
}

/**
 * useAcademicYear
 *
 * Reads the active academic year from Redux state (populated by
 * AcademicYearBootstrap on app mount). Use this in any page component
 * that needs academic_year_id — no extra fetch calls needed.
 *
 * @example
 * const { academicYearId, isReady, activeYear } = useAcademicYear();
 * if (!isReady) return <Spinner />;
 * // pass academicYearId to useApi calls
 */
export function useAcademicYear(): UseAcademicYearResult {
  const { activeYear, loading, bootstrapped, error } = useAppSelector(
    (s) => s.academicYear
  );

  return {
    activeYear,
    academicYearId: activeYear?.id ?? null,
    loading,
    bootstrapped,
    error,
    isReady: bootstrapped && activeYear !== null,
  };
}
