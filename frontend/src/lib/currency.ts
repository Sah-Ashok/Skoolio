/**
 * currency.ts  (frontend)
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for currency formatting on the frontend.
 *
 * The backend already resolves which currency a school should see via
 * resolved_pricing on the /subscriptions/plans response. This utility
 * formats those resolved numbers for display — no country/currency selection
 * logic lives here.
 *
 * To add a new currency (e.g. USD):
 *   1. Add the country → currency entry in Backend/src/config/currencyConfig.ts
 *   2. Add the currency code to the formatters below if needed (Intl handles most)
 *   That's it — this file needs no changes for new currencies.
 */

/** Format a resolved price number using the currency code from the API */
export function formatPrice(amount: number, currencyCode: string, symbol: string): string {
  if (amount === 0) return `${symbol}0`;

  // Use Intl for proper locale-aware formatting
  // NPR is not always supported by all browsers, so we fall back to symbol + number
  try {
    const formatted = new Intl.NumberFormat('en-IN', {
      style:                 'currency',
      currency:              currencyCode,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
    return formatted;
  } catch {
    // Fallback for unsupported currency codes (e.g. NPR in older browsers)
    return `${symbol}${amount.toLocaleString('en-IN')}`;
  }
}

/** Format just a number with thousands separators (no currency symbol) */
export function formatNumber(amount: number): string {
  return amount.toLocaleString('en-IN');
}

/**
 * Extract resolved pricing from a plan object returned by GET /subscriptions/plans.
 * Falls back gracefully if resolved_pricing is missing (old API version).
 */
export function getPlanPrice(
  plan: any,
  cycle: 'monthly' | 'yearly'
): { amount: number; symbol: string; code: string; display: string } {
  const rp = plan?.resolved_pricing;

  if (rp) {
    const amount = cycle === 'monthly' ? rp.price_monthly : rp.price_yearly;
    return {
      amount,
      symbol:  rp.symbol,
      code:    rp.currency,
      display: formatPrice(amount, rp.currency, rp.symbol),
    };
  }

  // Graceful fallback — should not reach here with current backend
  return { amount: 0, symbol: '', code: 'NPR', display: '—' };
}
