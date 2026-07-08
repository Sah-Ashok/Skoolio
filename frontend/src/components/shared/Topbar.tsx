"use client";

import Image from "next/image";
import Link from "next/link";
import { useAppSelector } from "@/store/hooks";

export type TopbarProps = {
  title:     string;
  subtitle?: string;
  greeting?: string;
};

export default function Topbar({ title, subtitle, greeting }: TopbarProps) {
  const { user } = useAppSelector(state => state.auth);

  const displayName =
    user?.full_name ||
    user?.school_name ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <div className="topbar">
      {/* ── Mobile logo (only visible on mobile via CSS) ── */}
      <div className="topbar-mobile-logo" aria-hidden="false">
        <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <Image
            src="/mobile-logo.png"
            alt="Skoolio"
            width={36}
            height={36}
            priority
            style={{ objectFit: "contain", width: 36, height: 36 }}
          />
        </Link>
      </div>

      {/* ── Page title (desktop only) ── */}
      <div className="topbar-left">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {/* ── Right actions ── */}
      <div className="topbar-right">
        {greeting ? (
          <div className="topbar-greeting" title={user?.email || displayName}>
            <span>{greeting}</span>
            <strong>{displayName}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
