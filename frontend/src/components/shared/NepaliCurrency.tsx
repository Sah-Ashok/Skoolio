"use client";

import React from "react";

interface NepaliCurrencyProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string; // e.g. "#f59e0b", "currentColor", etc.
  inline?: boolean;
}

/**
 * NepaliCurrency component renders the official Nepali currency SVG mark (/nepali-currency.svg).
 * It uses CSS mask-image so it automatically adopts `currentColor` (or custom color) and matches
 * surrounding text styling (font size, color, weight) across all themes and dark/light backgrounds.
 */
export default function NepaliCurrency({
  size = 15,
  className = "",
  style = {},
  color = "currentColor",
  inline = true,
}: NepaliCurrencyProps) {
  return (
    <span
      role="img"
      aria-label="Nepali Rupee (रू)"
      className={`inline-nepali-currency ${className}`.trim()}
      style={{
        display: inline ? "inline-block" : "block",
        width: size,
        height: size,
        minWidth: size,
        lineHeight: 1,
        verticalAlign: "-0.15em",
        maskImage: "url('/nepali-currency.svg')",
        WebkitMaskImage: "url('/nepali-currency.svg')",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        backgroundColor: color,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/**
 * Helper component that renders the Nepali currency SVG icon followed by the formatted amount.
 */
export function NepaliCurrencyAmount({
  amount,
  size = 14,
  className = "",
  style = {},
  color,
}: {
  amount: number | string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}) {
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
      <NepaliCurrency size={size} color={color} />
      <span>{Number(amount || 0).toLocaleString("en-IN")}</span>
    </span>
  );
}
