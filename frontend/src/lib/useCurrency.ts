import { useAppSelector } from '@/store/hooks';
import { useApi } from './useApi';
import { isNepaliCurrency } from '@/components/shared/NepaliCurrency';
export {
  default as NepaliCurrency,
  NepaliCurrencyAmount,
  CurrencyAmount,
  CurrencySymbol,
  isNepaliCurrency,
} from '@/components/shared/NepaliCurrency';

// Resolves school currency symbol from school settings and calendar system
function resolveSymbol(country: string | undefined | null, calendarSystem?: string, explicitCurrency?: string): string {
  if (explicitCurrency === 'USD') return '$';
  if (explicitCurrency === 'INR') return '₹';
  if (explicitCurrency === 'NPR') return 'रू';
  if (explicitCurrency === 'GBP') return '£';
  if (explicitCurrency === 'EUR') return '€';

  if (calendarSystem === 'BS') return 'रू';
  const c = country ? country.toLowerCase().trim() : '';
  if (c.includes('nepal') || c === 'np') return 'रू';
  if (c.includes('india') || c === 'in') return '₹';
  if (c.includes('united kingdom') || c === 'uk' || c === 'gb') return '£';
  if (c.includes('germany') || c.includes('france') || c.includes('spain') || c.includes('italy') || c.includes('euro')) return '€';
  if (c.includes('australia') || c === 'au') return 'A$';
  if (c.includes('canada') || c === 'ca') return 'C$';
  if (c.includes('uae') || c.includes('emirates') || c === 'ae') return 'AED ';
  if (c.includes('saudi') || c === 'sa') return 'SAR ';
  if (c.includes('japan') || c === 'jp') return '¥';
  if (c.includes('united states') || c === 'us' || c === 'usa') return '$';
  if (!country) return 'रू';
  return 'रू';
}

interface SchoolSettingsPayload {
  country?: string;
  calendar_system?: string;
  currency?: string;
}

export function useCurrency() {
  const user = useAppSelector(s => s.auth.user);
  const needsSettings = !user?.country && !user?.calendar_system;
  const { data: settings } = useApi<SchoolSettingsPayload>(needsSettings ? '/school/settings' : '');
  const country = user?.country || settings?.country;
  const calendarSystem = user?.calendar_system || settings?.calendar_system;
  const explicitCurrency = user?.currency || settings?.currency;
  const symbol = resolveSymbol(country, calendarSystem, explicitCurrency);
  const isNepali = isNepaliCurrency(symbol);
  const currencyIcon = isNepali ? '/nepali-currency.svg' : null;
  const isSouthAsian = symbol === 'रू' || symbol === 'रु' || symbol === '₹';
  const locale = isSouthAsian ? 'en-IN' : 'en-US';
  
  const fmt = (n: number | string, customSymbol?: string) =>
    `${customSymbol || symbol}${Number(n || 0).toLocaleString(locale)}`;

  const fmtShort = (n: number | string, customSymbol?: string) => {
    const sym = customSymbol || symbol;
    const num = Number(n || 0);
    if (isSouthAsian) {
      if (num >= 100_000) return `${sym}${(num / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
      if (num >= 1_000)   return `${sym}${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    } else {
      if (num >= 1_000_000) return `${sym}${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
      if (num >= 1_000)     return `${sym}${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    }
    return `${sym}${num.toLocaleString(locale)}`;
  };

  const formatRaw = (n: number | string) =>
    Number(n || 0).toLocaleString(locale);

  const formatRawShort = (n: number | string) => {
    const num = Number(n || 0);
    if (isSouthAsian) {
      if (num >= 100_000) return `${(num / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
      if (num >= 1_000)   return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    } else {
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
      if (num >= 1_000)     return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    }
    return Number(n || 0).toLocaleString(locale);
  };

  return {
    symbol,
    fmt,
    fmtShort,
    formatRaw,
    formatRawShort,
    isNepali,
    currencyIcon,
  };
}
