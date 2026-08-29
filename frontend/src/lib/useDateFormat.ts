/**
 * useDateFormat — central date formatting hook for Skoolio.
 *
 * DB always stores AD (ISO 'YYYY-MM-DD'). This hook converts FOR DISPLAY ONLY.
 * Network calls always send/receive AD strings — never send BS dates to the API.
 *
 * ── KEY RULE about AD→BS month mapping ──────────────────────────────────────
 * Every AD month STARTS roughly 2 weeks into a BS month.
 * For example:
 *   July  1 2025 AD  →  Ashadh  17 2082 BS   (still Ashadh)
 *   July 16 2025 AD  →  Shrawan  1 2082 BS   (Shrawan begins)
 *   July 31 2025 AD  →  Shrawan 15 2082 BS
 *
 * So when we want "the BS month label for AD July", we MUST NOT convert July 1
 * (which gives Ashadh). We convert July 15 or later instead — day 15 reliably
 * falls in the BS month that covers most of that AD month.
 *
 * All functions that convert an AD (year, month) pair to a BS label use day 15.
 */

import { useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';
import {
  adToBS, bsToISO, isoToBS,
  BS_MONTH_NAMES, daysInBSMonth,
  BSDate,
} from '@/lib/bs-ad';

const AD_MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const AD_MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Convert an AD (year, month 1-based) to the BS date of the 15th of that month.
 *  The 15th is safely inside whichever BS month covers the majority of that AD month. */
function adMonthToBS(adYear: number, adMonth: number): BSDate {
  const iso = `${adYear}-${String(adMonth).padStart(2, '0')}-15`;
  return isoToBS(iso);
}

export function useDateFormat() {
  const user = useAppSelector(s => s.auth.user);
  const isBS = (user?.calendar_system ?? 'AD') === 'BS';

  return useMemo(() => {

    /** Format an AD ISO string to a full display string */
    function formatDate(iso: string | null | undefined): string {
      if (!iso) return '—';
      const dateStr = String(iso).slice(0, 10);
      if (isBS) {
        const bs = isoToBS(dateStr);
        return `${bs.day} ${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`;
      }
      const [y, m, d] = dateStr.split('-').map(Number);
      return `${d} ${AD_MONTH_NAMES[m - 1]} ${y}`;
    }

    /** Short format: "13 Apr 2024" or "31 Shr 2082" */
    function formatDateShort(iso: string | null | undefined): string {
      if (!iso) return '—';
      const dateStr = String(iso).slice(0, 10);
      if (isBS) {
        const bs = isoToBS(dateStr);
        return `${bs.day} ${BS_MONTH_NAMES[bs.month - 1].slice(0, 3)} ${bs.year}`;
      }
      const [y, m, d] = dateStr.split('-').map(Number);
      return `${d} ${AD_MONTH_SHORT[m - 1]} ${y}`;
    }

    /**
     * Format just a month+year label from an AD (year, month 1-based) pair.
     *
     * For BS schools we convert the 15th of that AD month — NOT the 1st.
     * The 1st of any AD month always lands in the PREVIOUS BS month because
     * BS months start around the 13–17th of each AD month.
     *
     * Example (why day 1 is wrong):
     *   July  1 2025 → Ashadh 17 2082   ← wrong label for the July grid
     *   July 15 2025 → Ashadh 31 2082   ← still Ashadh (boundary is ~July 16)
     *   July 16 2025 → Shrawan  1 2082  ← correct BS month for AD July
     *
     * Using day 15 gives the BS month that the *majority* of that AD month
     * belongs to, which is what users expect to see as the calendar label.
     */
    function formatMonth(adYear: number, adMonth: number): string {
      if (isBS) {
        const bs = adMonthToBS(adYear, adMonth);
        return `${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`;
      }
      return `${AD_MONTH_NAMES[adMonth - 1]} ${adYear}`;
    }

    /** Month name for a BS month number (1-based) */
    function bsMonthName(month: number): string {
      return BS_MONTH_NAMES[month - 1] ?? '';
    }

    /** AD month name (1-based) */
    function adMonthName(month: number): string {
      return AD_MONTH_NAMES[month - 1] ?? '';
    }

    /** Convert an AD ISO string to what a <input type="date"> value should be. */
    function toInputValue(iso: string | null | undefined): string {
      if (!iso) return '';
      const dateStr = String(iso).slice(0, 10);
      if (!isBS) return dateStr;
      const bs = isoToBS(dateStr);
      return `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')}`;
    }

    /** Convert a date-input value back to an AD ISO string for the API. */
    function fromInputValue(val: string | null | undefined): string {
      if (!val) return '';
      if (!isBS) return val;
      const [y, m, d] = val.split('-').map(Number);
      return bsToISO({ year: y, month: m, day: d });
    }

    /** Today as an AD ISO string */
    function todayISO(): string {
      return new Date().toISOString().slice(0, 10);
    }

    /** Current BS year */
    function currentBSYear(): number {
      return adToBS(new Date()).year;
    }

    /** Current BS month (1-based) */
    function currentBSMonth(): number {
      return adToBS(new Date()).month;
    }

    /** Number of days in the currently displayed month */
    function daysInDisplayMonth(adYear: number, adMonth: number): number {
      if (!isBS) return new Date(adYear, adMonth, 0).getDate();
      const bs = adMonthToBS(adYear, adMonth);
      return daysInBSMonth(bs.year, bs.month);
    }

    /** Year label (e.g. "2082" for BS, "2025" for AD) */
    function yearLabel(adYear: number): string {
      if (!isBS) return String(adYear);
      const bs = adToBS(new Date(adYear, 3, 14)); // mid-Baishakh
      return String(bs.year);
    }

    /** Label for an AD ISO date range */
    function formatRange(startIso: string, endIso: string): string {
      return `${formatDateShort(startIso)} – ${formatDateShort(endIso)}`;
    }

    /**
     * Returns a stable group key + human label for grouping fee bills by month.
     *
     * AD schools: key = "YYYY-MM" (the AD month extracted from due_date).
     * BS schools: key = "BSYYYY-BSMM" derived from the EXACT BS conversion of
     *   each bill's due_date. This correctly handles the case where two bills
     *   with AD months that share the same day-15 label actually fall in
     *   different BS months (e.g. 2026-07-05 → Ashadh, 2026-07-25 → Shrawan),
     *   and also collapses bills from different AD months that fall in the same
     *   BS month into ONE group.
     *
     * Without this fix, two billing runs for "Ashadh 2083" with different
     * due_day values (e.g. 16th vs 25th of the AD month) produced TWO groups
     * both labelled "Ashadh 2083" because the keys were "2026-06" and "2026-07".
     *
     * @param isoDate - AD ISO date string "YYYY-MM-DD" from the DB
     */
    function billingGroupKey(isoDate: string): { key: string; label: string } {
      const dateStr = (isoDate || '').slice(0, 10);
      if (!dateStr || dateStr.length < 7) return { key: 'unknown', label: 'Unknown' };

      if (!isBS) {
        const key = dateStr.slice(0, 7); // "YYYY-MM"
        const [y, m] = key.split('-').map(Number);
        return { key, label: `${AD_MONTH_NAMES[m - 1]} ${y}` };
      }

      // BS: convert the exact date so each bill lands in its true BS month
      const bs  = isoToBS(dateStr);
      const key = `${bs.year}-${String(bs.month).padStart(2, '0')}`; // "BSYYYY-BSMM"
      return { key, label: `${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}` };
    }

    return {
      isBS,
      formatDate,
      formatDateShort,
      formatMonth,
      bsMonthName,
      adMonthName,
      toInputValue,
      fromInputValue,
      todayISO,
      currentBSYear,
      currentBSMonth,
      daysInDisplayMonth,
      yearLabel,
      formatRange,
      billingGroupKey,
    };
  }, [isBS]);
}
