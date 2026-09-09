/**
 * Bikram Sambat (BS) ↔ Gregorian (AD) conversion utility for Backend.
 *
 * DB always stores AD dates. This converts for display labels and period naming.
 */

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
  [2081, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [2082, 31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
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

const DAY_MS = 86_400_000;
const BS_EPOCH_UTC_DAY = Date.UTC(1943, 3, 14);
const BS_EPOCH_YEAR = 2000;
const LOOKUP_CALIBRATION_DAYS = 1;

function utcDayFromLocalDate(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getBSRow(year: number): number[] | null {
  return BS_DATA.find(r => r[0] === year) ?? null;
}

export interface BSDate { year: number; month: number; day: number; }

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

export function daysInBSMonth(year: number, month: number): number {
  const row = getBSRow(year);
  if (!row) return 30;
  return row[month]; // month is 1-based → row[1..12]
}

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

export function bsToAD(bs: BSDate): Date {
  const utcDate = new Date(
    BS_EPOCH_UTC_DAY +
    (bsDaysSinceEpoch(bs.year, bs.month, bs.day) + LOOKUP_CALIBRATION_DAYS) * DAY_MS,
  );
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

export function bsToISO(bs: BSDate): string {
  const ad = bsToAD(bs);
  const y  = ad.getFullYear();
  const m  = String(ad.getMonth() + 1).padStart(2, '0');
  const d  = String(ad.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoToBS(iso: string): BSDate {
  const [y, m, d] = iso.split('-').map(Number);
  return adToBS(new Date(y, m - 1, d || 15));
}

export const BS_MONTH_NAMES = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra',   'Ashwin', 'Kartik', 'Mangsir',
  'Poush',    'Magh',   'Falgun', 'Chaitra',
];

export function toBSMonthLabel(adYearMonth: string): string {
  if (!adYearMonth) return '';
  const dateStr = adYearMonth.length === 7 ? `${adYearMonth}-25` : adYearMonth;
  const bs = isoToBS(dateStr);
  return `${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`;
}

export function formatPeriodLabel(fromMonthStr: string, toMonthStr: string, monthsCount: number, isBS: boolean = true): string {
  if (!fromMonthStr || !toMonthStr) return '';
  if (isBS) {
    const fromBS = isoToBS(fromMonthStr.length === 7 ? `${fromMonthStr}-25` : fromMonthStr);
    const toBS   = isoToBS(toMonthStr.length === 7 ? `${toMonthStr}-25` : toMonthStr);
    const fromName = BS_MONTH_NAMES[fromBS.month - 1];
    const toName   = BS_MONTH_NAMES[toBS.month - 1];

    const bsMonthDiff = (toBS.year - fromBS.year) * 12 + (toBS.month - fromBS.month) + 1;
    const finalCount = bsMonthDiff > 0 ? bsMonthDiff : monthsCount;

    if (finalCount === 1 || (fromBS.year === toBS.year && fromBS.month === toBS.month)) {
      return `${fromName} ${fromBS.year}`;
    }
    if (fromBS.year === toBS.year) {
      return `${fromName} to ${toName} ${fromBS.year} · ${finalCount} Months`;
    }
    return `${fromName} ${fromBS.year} to ${toName} ${toBS.year} · ${finalCount} Months`;
  } else {
    const [fYStr, fMStr] = fromMonthStr.split('-');
    const [tYStr, tMStr] = toMonthStr.split('-');
    const fY = parseInt(fYStr, 10);
    const tY = parseInt(tYStr, 10);
    const fM = parseInt(fMStr, 10);
    const tM = parseInt(tMStr, 10);
    const d1 = new Date(fY, fM - 1, 1);
    const d2 = new Date(tY, tM - 1, 1);
    const fName = d1.toLocaleString('en-US', { month: 'short' });
    const tName = d2.toLocaleString('en-US', { month: 'short' });

    const adMonthDiff = (tY - fY) * 12 + (tM - fM) + 1;
    const finalCount = adMonthDiff > 0 ? adMonthDiff : monthsCount;

    if (finalCount === 1 || fromMonthStr === toMonthStr) {
      return `${fName} ${fY}`;
    }
    if (fY === tY) {
      return `${fName} to ${tName} ${fY} · ${finalCount} Months`;
    }
    return `${fName} ${fY} to ${tName} ${tY} · ${finalCount} Months`;
  }
}

