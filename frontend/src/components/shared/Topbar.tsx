"use client";

import Image from "next/image";
import Link from "next/link";
import { useAppSelector } from "@/store/hooks";

export type TopbarProps = {
  title:     string;
  subtitle?: string;
};

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { user } = useAppSelector(state => state.auth);

  const displayName =
    user?.full_name ||
    user?.school_name ||
    user?.email?.split("@")[0] ||
    "User";

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="topbar">
      {/* ── Mobile logo (only visible on mobile via CSS) ── */}
      <div className="topbar-mobile-logo" aria-hidden="false">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <Image
            src="/mobile-logo.png"
            alt="Skoolio"
            width={36}
            height={36}
            priority
            style={{ objectFit: "contain", width: 36, height: 36 }}
          />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span className="topbar-mobile-logo-name" style={{ fontSize: 15, fontWeight: 900 }}>
              Skoolio
            </span>
            {user?.school_name && (
              <span className="topbar-mobile-school-name" style={{ fontSize: 10, fontWeight: 700, color: "#64748b", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.school_name}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* ── Page title (desktop only) ── */}
      <div className="topbar-left">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {/* ── Right actions ── */}
      <div className="topbar-right">
        <div className="t-icon" title="Notifications">
          <i className="fa-regular fa-bell" />
          <span className="dot" />
        </div>
        <div className="t-icon" title="Messages">
          <i className="fa-regular fa-envelope" />
        </div>
        <div className="topbar-divider" />
        <div
          className="t-avatar"
          title={user?.email || displayName}
          aria-label={`Logged in as ${displayName}`}
        >
          {initials}
        </div>
      </div>
    </div>
  );
}
