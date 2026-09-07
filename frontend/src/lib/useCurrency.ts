import { useAppSelector } from '@/store/hooks';
import { useApi } from './useApi';

// Resolves school currency symbol from school settings and calendar system
function resolveSymbol(country: string | undefined | null, calendarSystem?: string): string {
  if (calendarSystem === 'BS') return 'रू';
  if (!country) return 'रू';
  const c = country.toLowerCase().trim();
  if (c.includes('nepal')) return 'रू';
  if (c.includes('india')) return '₹';
  return 'रू';
}

export function useCurrency() {
  const user = useAppSelector(s => s.auth.user);
  const { data: settings } = useApi<any>('/school/settings');
  const country = user?.country || settings?.country;
  const calendarSystem = user?.calendar_system || settings?.calendar_system;
  const symbol = resolveSymbol(country, calendarSystem);
  
  const fmt = (n: number | string, customSymbol?: string) =>
    `${customSymbol || symbol}${Number(n || 0).toLocaleString('en-IN')}`;

  const fmtShort = (n: number | string, customSymbol?: string) => {
    const sym = customSymbol || symbol;
    const num = Number(n || 0);
    if (num >= 100_000) return `${sym}${(num / 100_000).toFixed(1)}L`;
    if (num >= 1_000)   return `${sym}${(num / 1_000).toFixed(1)}K`;
    return `${sym}${num.toLocaleString('en-IN')}`;
  };

  return { symbol, fmt, fmtShort };
}
