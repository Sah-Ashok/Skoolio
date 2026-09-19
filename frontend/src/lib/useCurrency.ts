import { useAppSelector } from '@/store/hooks';
import { useApi } from './useApi';
export { default as NepaliCurrency, NepaliCurrencyAmount } from '@/components/shared/NepaliCurrency';

// Resolves school currency symbol from school settings and calendar system
function resolveSymbol(country: string | undefined | null, calendarSystem?: string, explicitCurrency?: string): string {
  if (explicitCurrency === 'USD') return '$';
  if (explicitCurrency === 'INR') return '₹';
  if (explicitCurrency === 'NPR') return 'रू';
  if (explicitCurrency === 'GBP') return '£';
  if (explicitCurrency === 'EUR') return '€';

  if (calendarSystem === 'BS') return 'रू';
  if (!country) return '$';
  const c = country.toLowerCase().trim();
  if (c.includes('nepal')) return 'रू';
  if (c.includes('india')) return '₹';
  if (c.includes('united kingdom') || c === 'uk' || c === 'gb') return '£';
  if (c.includes('germany') || c.includes('france') || c.includes('spain') || c.includes('italy') || c.includes('euro')) return '€';
  if (c.includes('australia')) return 'A$';
  if (c.includes('canada')) return 'C$';
  if (c.includes('uae') || c.includes('emirates')) return 'AED ';
  if (c.includes('saudi')) return 'SAR ';
  if (c.includes('japan')) return '¥';
  return '$';
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
  const isNepali = symbol === 'रू';
  const currencyIcon = isNepali ? '/nepali-currency.svg' : null;
  const isSouthAsian = symbol === 'रू' || symbol === '₹';
  const locale = isSouthAsian ? 'en-IN' : 'en-US';
  
  const fmt = (n: number | string, customSymbol?: string) =>
    `${customSymbol || symbol}${Number(n || 0).toLocaleString(locale)}`;

  const fmtShort = (n: number | string, customSymbol?: string) => {
    const sym = customSymbol || symbol;
    const num = Number(n || 0);
    if (isSouthAsian) {
      if (num >= 100_000) return `${sym}${(num / 100_000).toFixed(1)}L`;
      if (num >= 1_000)   return `${sym}${(num / 1_000).toFixed(1)}K`;
    } else {
      if (num >= 1_000_000) return `${sym}${(num / 1_000_000).toFixed(1)}M`;
      if (num >= 1_000)     return `${sym}${(num / 1_000).toFixed(1)}K`;
    }
    return `${sym}${num.toLocaleString(locale)}`;
  };

  return { symbol, fmt, fmtShort, isNepali, currencyIcon };
}

