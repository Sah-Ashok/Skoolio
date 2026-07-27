import { useApi } from './useApi';

// Resolves school currency symbol from school settings
// Matches the backend currencyConfig.ts logic
function resolveSymbol(country: string | undefined | null): string {
  if (!country) return 'रू'; // default NPR
  const c = country.toLowerCase().trim();
  if (c.includes('nepal'))  return 'रू';
  if (c.includes('india'))  return '₹';
  return 'रू';
}

export function useCurrency() {
  const { data: settings } = useApi<any>('/school/settings');
  const symbol = resolveSymbol(settings?.country);
  const fmt = (n: number | string) =>
    `${symbol}${Number(n).toLocaleString('en-IN')}`;
  return { symbol, fmt };
}
