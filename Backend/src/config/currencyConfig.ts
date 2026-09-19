/**
 * currencyConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for country → currency resolution.
 *
 * To add a new currency (e.g. USD for international schools):
 *   1. Add the country name to the map below with its config.
 *   2. Add the price columns to the `subscription_plans` table (migration).
 *   3. Add the currency symbol here.
 *   That's it — no other files need to change.
 *
 * Countries NOT in this map default to NPR (Nepal).
 */

export type SupportedCurrency = 'NPR' | 'INR' | 'USD';

export interface ICurrencyConfig {
  currency:    SupportedCurrency;
  symbol:      string;          // display symbol, e.g. "₹", "$", "NPR "
  priceKey:    'npr' | 'inr' | 'usd';  // key fragment used in subscription_plans columns
}

// ── Map: school country (case-insensitive match) → currency config ────────────
const COUNTRY_CURRENCY_MAP: Record<string, ICurrencyConfig> = {
  nepal: {
    currency: 'NPR',
    symbol:   'रु ',
    priceKey: 'npr',
  },
  np: {
    currency: 'NPR',
    symbol:   'रु ',
    priceKey: 'npr',
  },
  india: {
    currency: 'INR',
    symbol:   '₹',
    priceKey: 'inr',
  },
  in: {
    currency: 'INR',
    symbol:   '₹',
    priceKey: 'inr',
  },
  global: {
    currency: 'USD',
    symbol:   '$',
    priceKey: 'usd',
  },
  'united states': {
    currency: 'USD',
    symbol:   '$',
    priceKey: 'usd',
  },
  us: {
    currency: 'USD',
    symbol:   '$',
    priceKey: 'usd',
  },
  usa: {
    currency: 'USD',
    symbol:   '$',
    priceKey: 'usd',
  },
  'united kingdom': {
    currency: 'USD',
    symbol:   '£',
    priceKey: 'usd',
  },
  uk: {
    currency: 'USD',
    symbol:   '£',
    priceKey: 'usd',
  },
  gb: {
    currency: 'USD',
    symbol:   '£',
    priceKey: 'usd',
  },
  canada: {
    currency: 'USD',
    symbol:   'C$',
    priceKey: 'usd',
  },
  ca: {
    currency: 'USD',
    symbol:   'C$',
    priceKey: 'usd',
  },
  australia: {
    currency: 'USD',
    symbol:   'A$',
    priceKey: 'usd',
  },
  au: {
    currency: 'USD',
    symbol:   'A$',
    priceKey: 'usd',
  },
  uae: {
    currency: 'USD',
    symbol:   'AED ',
    priceKey: 'usd',
  },
  'united arab emirates': {
    currency: 'USD',
    symbol:   'AED ',
    priceKey: 'usd',
  },
};

/** Default when a country is not in the map — global default is USD ($) */
const DEFAULT_CONFIG: ICurrencyConfig = {
  currency: 'USD',
  symbol:   '$',
  priceKey: 'usd',
};

/**
 * Resolve the currency config for a given school country string.
 * Case-insensitive. Falls back to NPR if not found.
 */
export function resolveCurrencyConfig(country: string | null | undefined): ICurrencyConfig {
  if (!country) return DEFAULT_CONFIG;
  const key = country.toLowerCase().trim();
  return COUNTRY_CURRENCY_MAP[key] ?? DEFAULT_CONFIG;
}

/**
 * Given a plan row from DB and a country, return the resolved pricing object
 * that the frontend/API consumer should display — no price-selection logic needed
 * anywhere else.
 */
export function resolvePlanPricing(
  plan: Record<string, any>,
  country: string | null | undefined
): {
  currency:        SupportedCurrency;
  symbol:          string;
  price_monthly:   number;
  price_yearly:    number;
  price_key:       string;   // e.g. "npr", "inr", "usd"
} {
  const cfg = resolveCurrencyConfig(country);
  return {
    currency:      cfg.currency,
    symbol:        cfg.symbol,
    price_monthly: Number(plan[`price_${cfg.priceKey}_monthly`] ?? 0),
    price_yearly:  Number(plan[`price_${cfg.priceKey}_yearly`]  ?? 0),
    price_key:     cfg.priceKey,
  };
}
