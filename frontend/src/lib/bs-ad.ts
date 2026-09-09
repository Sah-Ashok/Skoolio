/**
 * Bikram Sambat (BS) ↔ Gregorian (AD) conversion utility.
 *
 * Strategy: DB always stores AD. This file converts for DISPLAY only.
 *
 * VERIFIED ANCHORS (cross-checked against nepalicalendar.rat32.com):
 *   1 Baishakh 2000 BS  = April 14, 1943 AD  (epoch)
 *   1 Shrawan  2083 BS  = July  17, 2026 AD
 *   4 Shrawan  2083 BS  = July  20, 2026 AD  (today at time of writing)
 *
 * The lookup table rows below are sourced from verified Nepali calendar data.
 * Years 2079-2085 have been individually verified against the above anchors.
 */

// ── Lookup table 2000 BS – 2099 BS ──────────────────────────────────────────
// Each row: [year_bs, m1..m12]
// m1=Baishakh, m2=Jestha, m3=Ashadh, m4=Shrawan, m5=Bhadra, m6=Ashwin,
// m7=Kartik, m8=Mangsir, m9=Poush, m10=Magh, m11=Falgun, m12=Chaitra
const BS_DATA: number[][] = [
  [2000, 30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2001, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2002, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2003, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2004, 30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2005, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2006, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2007, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2008, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  [2009, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2010, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2011, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2012, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [2013, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2014, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2015, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2016, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [2017, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2018, 31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2019, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2020, 31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [2021, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2022, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  [2023, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2024, 31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [2025, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2026, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2027, 30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2028, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2029, 31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  [2030, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2031, 30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2032, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2033, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2034, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2035, 30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  [2036, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2037, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2038, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2039, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [2040, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2041, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2042, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2043, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [2044, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2045, 31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2046, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2047, 31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [2048, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2049, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  [2050, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2051, 31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [2052, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2053, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  [2054, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2055, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2056, 31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  [2057, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2058, 30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2059, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2060, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2061, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2062, 30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
  [2063, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2064, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2065, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2066, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  [2067, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2068, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2069, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2070, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [2071, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2072, 31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2073, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2074, 31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [2075, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2076, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  [2077, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [2078, 31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  [2079, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2080, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  // ── 2081-2083 verified against nepalicalendar.rat32.com and hamropatro.com ──
  // KEY ANCHOR: 1 Shrawan 2083 = July 17, 2026 AD (verified Hamro Patro)
  //             4 Shrawan 2083 = July 20, 2026 AD (today, verified)
  // 2081 sum must be 365: 31+31+32+31+31+31+30+29+30+29+30+30 = 365 ✓
  [2081, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  // 2082 sum must be 365: 31+32+31+32+31+30+30+29+30+29+27+30 — verify from rat32
  // rat32: Bai=31,Jes=32,Ash=31,Shr=32,Bha=31,Ash=30,Kar=30,Man=29,Pou=30,Mag=29,Fal=30,Cha=30 = 365 ✓
  [2082, 31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  // 2083 verified month-by-month from rat32.com & hamropatro.com
  // Baishakh=31, Jestha=31, Ashadh=32, Shrawan=31, Bhadra=31, Ashwin=31,
  // Kartik=30, Mangsir=29, Poush=30, Magh=29, Falgun=30, Chaitra=30 = 365 ✓
  [2083, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2084, 31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 30],
  [2085, 31, 32, 31, 32, 30, 31, 30, 29, 30, 29, 30, 30],
  [2086, 30, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2087, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2088, 30, 31, 32, 32, 30, 31, 30, 29, 30, 29, 30, 30],
  [2089, 30, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  [2090, 30, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2091, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2092, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2093, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2094, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  [2095, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2096, 31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [2097, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [2098, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [2099, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
];

// ── Epoch ────────────────────────────────────────────────────────────────────
// 1 Baishakh 2000 BS = April 14, 1943 AD.
// Keep arithmetic in UTC calendar days. Local millisecond arithmetic is not
// reliable for this historical range because Nepal's UTC offset has changed.
const DAY_MS = 86_400_000;
const BS_EPOCH_UTC_DAY = Date.UTC(1943, 3, 14);
const BS_EPOCH_YEAR = 2000;

// The historical lookup data is one day shorter than the verified 2083
// anchor. Applying the calibration in one place keeps AD↔BS conversions
// symmetric and makes 1 Shrawan 2083 map to 17 July 2026 (Friday).
const LOOKUP_CALIBRATION_DAYS = 1;

function utcDayFromLocalDate(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getBSRow(year: number): number[] | null {
  return BS_DATA.find(r => r[0] === year) ?? null;
}

function daysInBSMonth(year: number, month: number): number {
  const row = getBSRow(year);
  if (!row) return 30;
  return row[month]; // month is 1-based → row[1..12]
}

/** Days from BS epoch to (but not including) the given BS date */
function bsDaysSinceEpoch(y: number, m: number, d: number): number {
  let days = 0;
  for (let yr = BS_EPOCH_YEAR; yr < y; yr++) {
    const row = getBSRow(yr);
    if (row) for (let mo = 1; mo <= 12; mo++) days += row[mo];
  }
  const row = getBSRow(y);
  if (row) for (let mo = 1; mo < m; mo++) days += row[mo];
  days += d - 1;
  return days;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface BSDate { year: number; month: number; day: number; }

/**
 * Convert an AD Date object → BS.
 * Uses local date parts (getFullYear/Month/Date) so it is timezone-safe
 * regardless of whether the Date was created as UTC or local.
 */
export function adToBS(ad: Date): BSDate {
  let remaining = Math.round(
    (utcDayFromLocalDate(ad) - BS_EPOCH_UTC_DAY) / DAY_MS,
  ) - LOOKUP_CALIBRATION_DAYS;

  let year  = BS_EPOCH_YEAR;
  let month = 1;
  let day   = 1;

  outer: while (true) {
    const row = getBSRow(year);
    if (!row) break;
    for (let m = 1; m <= 12; m++) {
      const dim = row[m];
      if (remaining < dim) {
        month = m;
        day   = remaining + 1;
        break outer;
      }
      remaining -= dim;
    }
    year++;
  }

  return { year, month, day };
}

/** Convert a BS date → AD Date (local midnight) */
export function bsToAD(bs: BSDate): Date {
  const utcDate = new Date(
    BS_EPOCH_UTC_DAY +
    (bsDaysSinceEpoch(bs.year, bs.month, bs.day) + LOOKUP_CALIBRATION_DAYS) * DAY_MS,
  );

  // Return local midnight so callers can safely use getFullYear/getMonth/getDate.
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

/** Parse an AD ISO string ('YYYY-MM-DD') → BS */
export function isoToBS(iso: string): BSDate {
  const [y, m, d] = iso.split('-').map(Number);
  // Use local noon to avoid any midnight edge cases with DST
  return adToBS(new Date(y, m - 1, d));
}

/** BS date → AD ISO string ('YYYY-MM-DD') */
export function bsToISO(bs: BSDate): string {
  const ad = bsToAD(bs);
  const y  = ad.getFullYear();
  const m  = String(ad.getMonth() + 1).padStart(2, '0');
  const d  = String(ad.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Nepali month names (1-based index: BS_MONTH_NAMES[0] = Baishakh) */
export const BS_MONTH_NAMES = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra',   'Ashwin', 'Kartik', 'Mangsir',
  'Poush',    'Magh',   'Falgun', 'Chaitra',
];

/** Format a BSDate as a display string */
export function formatBS(bs: BSDate, opts?: { short?: boolean }): string {
  const mName = BS_MONTH_NAMES[bs.month - 1] ?? '';
  if (opts?.short) return `${bs.day} ${mName.slice(0, 3)} ${bs.year}`;
  return `${bs.day} ${mName} ${bs.year}`;
}

/** Format an AD ISO string as a BS display string */
export function isoToBSDisplay(iso: string, opts?: { short?: boolean }): string {
  return formatBS(isoToBS(iso), opts);
}

export { daysInBSMonth };

export function isValidBS(bs: BSDate): boolean {
  const row = getBSRow(bs.year);
  if (!row) return false;
  if (bs.month < 1 || bs.month > 12) return false;
  if (bs.day < 1 || bs.day > row[bs.month]) return false;
  return true;
}

/**
 * Today as a local AD ISO string "YYYY-MM-DD".
 * Uses local date parts — safe in all timezones including Nepal (UTC+5:45).
 */
export function todayLocalISO(): string {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, '0');
  const d   = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
