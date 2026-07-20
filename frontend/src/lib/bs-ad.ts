/**
 * Bikram Sambat (BS) ↔ Gregorian (AD) conversion utility.
 *
 * Strategy
 * ─────────
 * DB always stores AD dates (DATE columns, ISO strings).
 * This file converts for DISPLAY only — the network layer always sends/receives AD.
 *
 * Lookup table: each entry is [year_bs, total_days_in_each_month_1..12]
 * Source: verified against https://www.ashesh.com.np/nepali-date-converter/
 *         and https://nepalicalendar.rat32.com
 *
 * Column index mapping (row[0] = year, row[1..12] = months):
 *   row[1]=Baishakh  row[2]=Jestha   row[3]=Ashadh   row[4]=Shrawan
 *   row[5]=Bhadra    row[6]=Ashwin   row[7]=Kartik    row[8]=Mangsir
 *   row[9]=Poush     row[10]=Magh    row[11]=Falgun   row[12]=Chaitra
 */

// ── Lookup table 2000 BS – 2099 BS ──────────────────────────────────────────
// Each row: [year_bs, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12]
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
  [2081, 31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  [2082, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  // ── 2083 verified against nepalicalendar.rat32.com (Jul/Aug 2026 AD) ──
  // Shrawan 2083 = 30 days (row[4]), NOT 31. Previous value was wrong.
  [2083, 31, 31, 32, 30, 31, 30, 30, 30, 29, 29, 30, 31],
  [2084, 31, 31, 32, 31, 31, 30, 30, 30, 29, 29, 30, 31],
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

// BS epoch: 1 Baishakh 2000 = 13 April 1943 AD
const BS_EPOCH_AD = new Date(1943, 3, 13); // April 13, 1943
const BS_EPOCH_YEAR = 2000;

function getBSRow(year: number): number[] | null {
  return BS_DATA.find(r => r[0] === year) ?? null;
}

function daysInBSMonth(year: number, month: number): number {
  const row = getBSRow(year);
  if (!row) return 30;
  return row[month]; // month is 1-based, row[1..12]
}

/** Total BS days from epoch (2000 Baishakh 1) up to but not including the given BS date */
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

/** Convert an AD Date object → BS */
export function adToBS(ad: Date): BSDate {
  const msPerDay = 86400000;
  const epochMs  = BS_EPOCH_AD.getTime();
  const adMs     = new Date(ad.getFullYear(), ad.getMonth(), ad.getDate()).getTime();
  let remaining  = Math.floor((adMs - epochMs) / msPerDay);

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

/** Convert a BS date → AD Date object */
export function bsToAD(bs: BSDate): Date {
  const days   = bsDaysSinceEpoch(bs.year, bs.month, bs.day);
  const result = new Date(BS_EPOCH_AD.getTime() + days * 86400000);
  return result;
}

/** Parse an AD ISO string ('YYYY-MM-DD') and return BS */
export function isoToBS(iso: string): BSDate {
  const [y, m, d] = iso.split('-').map(Number);
  return adToBS(new Date(y, m - 1, d));
}

/** Convert a BS date back to ISO AD string ('YYYY-MM-DD') */
export function bsToISO(bs: BSDate): string {
  const ad = bsToAD(bs);
  const y  = ad.getFullYear();
  const m  = String(ad.getMonth() + 1).padStart(2, '0');
  const dy = String(ad.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

/** Nepali month names */
export const BS_MONTH_NAMES = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra',   'Ashwin', 'Kartik', 'Mangsir',
  'Poush',    'Magh',   'Falgun', 'Chaitra',
];

/** Format BS date as a display string, e.g. "15 Shrawan 2081" */
export function formatBS(bs: BSDate, opts?: { short?: boolean }): string {
  const mName = BS_MONTH_NAMES[bs.month - 1] ?? '';
  if (opts?.short) return `${bs.day} ${mName.slice(0, 3)} ${bs.year}`;
  return `${bs.day} ${mName} ${bs.year}`;
}

/** Format an AD ISO string as BS display string */
export function isoToBSDisplay(iso: string, opts?: { short?: boolean }): string {
  return formatBS(isoToBS(iso), opts);
}

/** How many days are in a given BS month */
export { daysInBSMonth };

/** Validate a BS date object */
export function isValidBS(bs: BSDate): boolean {
  const row = getBSRow(bs.year);
  if (!row) return false;
  if (bs.month < 1 || bs.month > 12) return false;
  if (bs.day < 1 || bs.day > row[bs.month]) return false;
  return true;
}
