"use client";

import React from "react";

export interface NepaliCurrencyProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string; // e.g. "#f59e0b", "currentColor", etc.
  inline?: boolean;
}

/**
 * NepaliCurrency component renders the official Nepali currency SVG mark (/nepali-currency.svg).
 * It uses the SVG vector paths with `stroke={color}` (default "currentColor") so it seamlessly
 * inherits font color, scales cleanly, and renders instantly without any network fetch delay or FOUC.
 */
export default function NepaliCurrency({
  size = 15,
  className = "",
  style = {},
  color = "currentColor",
  inline = true,
}: NepaliCurrencyProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Nepali Rupee (रू)"
      className={`inline-nepali-currency ${className}`.trim()}
      style={{
        display: inline ? "inline-block" : "block",
        verticalAlign: "-0.15em",
        flexShrink: 0,
        ...style,
      }}
    >
      <path d="M18 16.173 A4.74 4.74 0 0 0 13.496 8.005" />
      <path d="M4 3 L20 3" />
      <path d="M5 13 L13.5 21" />
      <path d="M5 13 L9 13" />
      <path d="M8 13 C15.5 13 14.667 3 8 3" />
    </svg>
  );
}

export function isNepaliCurrency(sym?: string | null): boolean {
  if (!sym) return true; // Default in Skoolio
  const clean = sym.trim();
  return (
    clean === "रू" ||
    clean === "रु" ||
    clean === "NPR" ||
    clean.toUpperCase().includes("NPR") ||
    clean === "Rs." ||
    clean === "Rs" ||
    clean === "रु."
  );
}

/**
 * Smart currency symbol component.
 * Automatically renders the NepaliCurrency SVG if the currency is Nepali (NPR / रू / रु / Rs.),
 * or renders a text span with the symbol ($ / ₹ / € / £) if another currency.
 */
export function CurrencySymbol({
  symbol = "रू",
  size = 14,
  className = "",
  style = {},
  color = "currentColor",
}: {
  symbol?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}) {
  if (isNepaliCurrency(symbol)) {
    return <NepaliCurrency size={size} className={className} style={style} color={color} />;
  }
  return (
    <span className={className} style={{ color, ...style }}>
      {symbol}
    </span>
  );
}

/**
 * Helper component that renders the currency mark (Nepali SVG or currency symbol)
 * followed by the formatted amount.
 */
export function CurrencyAmount({
  amount,
  size = 14,
  short = false,
  className = "",
  style = {},
  color,
  customSymbol = "रू",
  prefix,
}: {
  amount: number | string;
  size?: number;
  short?: boolean;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  customSymbol?: string;
  prefix?: string;
}) {
  const isNepali = isNepaliCurrency(customSymbol);
  const num = Number(amount || 0);

  let formattedNumber = "";
  if (short) {
    if (num >= 100_000) {
      formattedNumber = `${(num / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
    } else if (num >= 1_000) {
      formattedNumber = `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    } else {
      formattedNumber = num.toLocaleString("en-IN");
    }
  } else {
    formattedNumber = num.toLocaleString("en-IN");
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        ...style,
      }}
      className={className}
    >
      {prefix && <span>{prefix}</span>}
      {isNepali ? (
        <NepaliCurrency size={size} color={color} />
      ) : (
        <span style={{ color }}>{customSymbol}</span>
      )}
      <span style={{ color }}>{formattedNumber}</span>
    </span>
  );
}

// Backward-compatible alias
export const NepaliCurrencyAmount = CurrencyAmount;
