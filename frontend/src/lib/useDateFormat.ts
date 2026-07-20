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

    /** Convert a date-input value back to an AD ISO string for API calls. */
    function fromInputValue(val: string | null | undefined): string {
      if (!val) return '';
      const str = String(val).slice(0, 10);
      if (!isBS) return str;
      const [y, m, d] = str.split('-').map(Number);
      return bsToISO({ year: y, month: m, day: d });
    }

    /** Today as an AD ISO string — always AD, safe for API calls */
    function todayISO(): string {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    /** Current BS year (for BS schools) */
    function currentBSYear(): number {
      return adToBS(new Date()).year;
    }

    /** Current BS month (1-based, for BS schools) */
    function currentBSMonth(): number {
      return adToBS(new Date()).month;
    }

    /**
     * Days in a displayed month.
     * For AD: standard JS.
     * For BS: look up via the BS month that day 15 of the AD month falls in.
     *
     * Same day-15 rule applies here — using day 1 would give the previous BS
     * month's day count, which is wrong.
     */
    function daysInDisplayMonth(adYear: number, adMonth: number): number {
      if (!isBS) return new Date(adYear, adMonth, 0).getDate();
      const bs = adMonthToBS(adYear, adMonth);
      return daysInBSMonth(bs.year, bs.month);
    }

    /** Year label for display */
    function yearLabel(adYear: number): string {
      if (!isBS) return String(adYear);
      const bs = adToBS(new Date(adYear, 3, 14)); // mid-Baishakh
      return String(bs.year);
    }

    /** Label for an AD ISO date range */
    function formatRange(startIso: string, endIso: string): string {
      return `${formatDateShort(startIso)} – ${formatDateShort(endIso)}`;
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
    };
  }, [isBS]);
}
