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
  
  const fmt = (n: number | string) =>
    `${symbol}${Number(n || 0).toLocaleString('en-IN')}`;
    
  return { symbol, fmt };
}
