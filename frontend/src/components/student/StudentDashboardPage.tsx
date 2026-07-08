"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";
import React from "react";

/* ─── tiny inline donut (no external dep) ─── */
function DonutChart({
  percentage,
  present,
  absent,
  total,
}: {
  percentage: number;
  present: number;
  absent: number;
  total: number;
}) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const presentArc = (percentage / 100) * circ;
  const absentArc = circ - presentArc;

  return (
    <div className="sd-donut-wrap">
      <div className="sd-donut-left">
        <svg viewBox="0 0 140 140" className="sd-donut-svg">
          {/* track */}
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
          {/* absent arc (red / bottom) */}
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#ff9a9e"
            strokeWidth="16"
            strokeDasharray={`${absentArc} ${presentArc}`}
            strokeDashoffset={-presentArc}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
          {/* present arc (blue) */}
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#4b8ff7"
            strokeWidth="16"
            strokeDasharray={`${presentArc} ${absentArc}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
          <text x="70" y="65" textAnchor="middle" fontSize="26" fontWeight="900" fill="#1e293b">
            {percentage}%
          </text>
          <text x="70" y="83" textAnchor="middle" fontSize="12" fill="#94a3b8" fontWeight="600">
            present
          </text>
        </svg>
      </div>

      <div className="sd-donut-legend">
        <div className="sd-legend-item">
          <span className="sd-legend-dot sd-dot-blue" />
          <div>
            <div className="sd-legend-label">Present</div>
            <div className="sd-legend-val">{present} days</div>
          </div>
        </div>
        <div className="sd-legend-item">
          <span className="sd-legend-dot sd-dot-red" />
          <div>
            <div className="sd-legend-label">Absent</div>
            <div className="sd-legend-val">{absent} days</div>
          </div>
        </div>
        <div className="sd-legend-sub">Out of {total} working days</div>
      </div>
    </div>
  );
}

/* ─── attendance period tab ─── */
type Period = "this_month" | "last_month" | "full_year";

export default function StudentDashboardPage() {
  const { user } = useAppSelector((s) => s.auth);
  const { data: me, loading: meLoading } = useApi<any>("/auth/me");
  const { data: activeYear } = useApi<any>("/academic-years/active");

  /* ── Attendance for three periods ── */
  const today = new Date();

  // This month
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  // Last month
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0];
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    .toISOString()
    .split("T")[0];

  // Full year
  const yearStart = activeYear?.start_date || `${today.getFullYear()}-04-01`;

  const { data: attThisMonth, loading: loadingThis } = useApi<any>(
    activeYear?.id
      ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${thisMonthStart}&end_date=${todayStr}`
      : "",
    [activeYear?.id]
  );

  const { data: attLastMonth, loading: loadingLast } = useApi<any>(
    activeYear?.id
      ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${lastMonthStart}&end_date=${lastMonthEnd}`
      : "",
    [activeYear?.id]
  );

  const { data: attFullYear, loading: loadingYear } = useApi<any>(
    activeYear?.id
      ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${yearStart}&end_date=${todayStr}`
      : "",
    [activeYear?.id]
  );

  /* ── Fees ── */
  const { data: feeCollections } = useApi<any[]>("/fees/me/collections");
  const pendingFees = (feeCollections || []).filter((f) => f.status !== "paid");
  const totalDue = pendingFees.reduce(
    (sum, f) => sum + Number(f.remaining_amount || 0),
    0
  );
  const fmtINR = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  /* ── Greeting ── */
  const hour = today.getHours();
  // Using an emoji or icon similar to the image (cloud with sun)
  const greetEmoji = "⛅";
  const greetWord =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const firstName = (me?.full_name || user?.full_name || "Student").split(" ")[0];

  /* ── Period state ── */
  const [period, setPeriod] = React.useState<Period>("this_month");

  const attMap = {
    this_month: { data: attThisMonth, loading: loadingThis },
    last_month: { data: attLastMonth, loading: loadingLast },
    full_year: { data: attFullYear, loading: loadingYear },
  };

  const { data: curAtt, loading: curLoading } = attMap[period];

  const pct = Math.round(curAtt?.attendance_percentage ?? 0);
  const present = curAtt?.present_days ?? 0;
  const absent = curAtt?.absent_days ?? 0;
  const total = (curAtt?.total_working_days ?? present + absent) || present + absent;

  /* ── Quick access cards ── */
  const quickCards = [
    {
      href: "/student/fees",
      icon: "fa-money-bill-wave",
      iconBg: "#fef3c7",
      iconColor: "#d97706",
      label: "My Fees",
      sub: totalDue > 0 ? `${fmtINR(totalDue)} due` : "No dues",
      subBg: totalDue > 0 ? "#ffedd5" : "transparent",
      subColor: totalDue > 0 ? "#ea580c" : "#94a3b8",
    },
    {
      href: "/student/results",
      icon: "fa-file-lines",
      iconBg: "#dcfce7",
      iconColor: "#16a34a",
      label: "Exam Results",
      sub: "Term 1 out",
      subBg: "#dcfce7",
      subColor: "#16a34a",
    },
    {
      href: "/student/profile",
      icon: "fa-user",
      iconBg: "#f3e8ff",
      iconColor: "#9333ea",
      label: "My Profile",
      sub: me?.admission_number || "—",
      subBg: "transparent",
      subColor: "#94a3b8",
    },
    {
      href: "/student/calendar",
      icon: "fa-calendar",
      iconBg: "#ffe4e6",
      iconColor: "#e11d48",
      label: "Calendar",
      sub: "2 events",
      subBg: "transparent",
      subColor: "#94a3b8",
    },
  ];

  const schoolName = me?.school_name || user?.school_name || "Your School";
  const schoolLogo = me?.logo || user?.logo; 

  return (
    <>
      {/* ══ Scoped styles ══ */}
      <style>{`
        /* ─── Page shell ─── */
        .sd-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: #f6f8fa; /* Light greyish blue background from image */
          font-family: var(--font-inter), sans-serif;
        }

        /* ─── Topbar override for student ─── */
        .sd-topbar {
          background: #fff;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        
        .sd-topbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .sd-topbar-greeting {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .sd-greeting-emoji {
          font-size: 20px;
        }

        .sd-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        /* ─── Mobile topbar ─── */
        .sd-mobile-topbar {
          display: none;
        }

        /* ─── Main content ─── */
        .sd-content {
          padding: 24px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 600px; /* Keep it relatively narrow to match the mobile-first design */
          margin: 0 auto;
          width: 100%;
        }

        /* ─── Greeting Section (Mobile) ─── */
        .sd-greeting-section {
          display: none; /* Shown only on mobile */
          align-items: center;
          gap: 12px;
        }
        
        /* ─── School Info ─── */
        .sd-school-info {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 8px;
        }
        .sd-school-logo {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          background: #fff;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .sd-school-name {
          font-family: 'Playfair Display', Georgia, serif; /* Serif font as requested */
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }

        /* ─── Section Titles ─── */
        .sd-section-title {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 12px;
        }

        /* ─── Quick Access Grid ─── */
        .sd-quick-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .sd-quick-card {
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .sd-quick-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.04);
        }
        .sd-quick-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }
        .sd-quick-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sd-quick-label {
          font-size: 14px;
          font-weight: 800;
          color: #334155;
        }
        .sd-quick-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
          display: inline-block;
          width: fit-content;
        }

        /* ─── Attendance Card ─── */
        .sd-att-container {
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }
        .sd-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }
        .sd-tab {
          flex: 1;
          padding: 8px 0;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          border: 1px solid #e2e8f0;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .sd-tab.active {
          background: #1e293b;
          color: #fff;
          border-color: #1e293b;
        }

        /* ─── Donut Layout ─── */
        .sd-donut-wrap {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .sd-donut-left {
          flex-shrink: 0;
        }
        .sd-donut-svg {
          width: 130px;
          height: 130px;
          transform: rotate(-90deg);
        }
        .sd-donut-svg text {
          transform: rotate(90deg);
          transform-origin: 70px 70px;
        }
        .sd-donut-legend {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .sd-legend-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .sd-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          flex-shrink: 0;
          margin-top: 4px;
        }
        .sd-dot-blue { background: #4b8ff7; }
        .sd-dot-red  { background: #ff9a9e; }
        
        .sd-legend-label {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
        }
        .sd-legend-val {
          font-size: 14px;
          font-weight: 800;
          color: #1e293b;
          margin-top: 2px;
        }
        .sd-legend-sub {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }

        /* ─── Spinner placeholder ─── */
        .sd-spin-center {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 60px 0;
        }

        /* ══════════════════════════════
           MOBILE — 768px and below
        ══════════════════════════════ */
        @media (max-width: 768px) {
          /* hide desktop topbar, show mobile topbar */
          .sd-topbar { display: none; }
          .sd-mobile-topbar {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: #fff;
            border-bottom: 2px solid #e2e8f0;
          }
          .sd-mobile-logo {
            height: 32px;
            object-fit: contain;
          }

          .sd-content {
            padding: 20px;
          }
          
          .sd-greeting-section {
            display: flex;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
          }
          
          .sd-school-name {
            font-size: 24px;
          }
          .sd-school-logo {
            width: 70px;
            height: 70px;
          }

          /* Donut: keep side-by-side on mobile too */
          .sd-donut-wrap {
            flex-direction: row;
            align-items: center;
            gap: 20px;
          }
          .sd-donut-svg {
            width: 110px;
            height: 110px;
          }
          .sd-donut-legend {
            width: auto;
            flex-direction: column;
            gap: 12px;
          }
          .sd-legend-sub { width: auto; margin-top: 4px; font-size: 10px; }

          /* Quick: keep 2×2 grid on mobile too */
          .sd-quick-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .sd-quick-card { padding: 16px; gap: 12px; }
          
          .sd-att-container { padding: 16px; }
          .sd-tabs { gap: 6px; }
          .sd-tab { font-size: 11px; padding: 6px 0; }
        }

        /* Very small (320-380px) */
        @media (max-width: 380px) {
          .sd-donut-wrap { gap: 12px; }
          .sd-donut-svg { width: 100px; height: 100px; }
          .sd-school-name { font-size: 20px; }
        }
      `}</style>

      <div className="sd-page">
        {/* ══ DESKTOP TOPBAR ══ */}
        <header className="sd-topbar">
          <div className="sd-topbar-left">
            <div className="sd-topbar-greeting">
              <span className="sd-greeting-emoji">{greetEmoji}</span>
              {greetWord} , {firstName}
            </div>
          </div>
          <div className="sd-topbar-right">
            <div className="sd-avatar">
              <i className="fa-solid fa-user" />
            </div>
          </div>
        </header>

        {/* ══ MOBILE TOPBAR ══ */}
        <header className="sd-mobile-topbar">
          <img src="/mobile-logo.png" alt="Skoolio" className="sd-mobile-logo" onError={(e) => e.currentTarget.src = "/Logo.png"} />
        </header>

        {/* ══ PAGE CONTENT ══ */}
        {meLoading ? (
          <div className="sd-spin-center">
            <Spinner size={32} color="#4b8ff7" />
          </div>
        ) : (
          <main className="sd-content">

            {/* ── Greeting (Mobile Only) ── */}
            <div className="sd-greeting-section">
              <span className="sd-greeting-emoji">{greetEmoji}</span>
              {greetWord} , {firstName}
            </div>

            {/* ── School Info ── */}
            <div className="sd-school-info">
              {schoolLogo && (
                <img src={schoolLogo} alt="School Logo" className="sd-school-logo" onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}/>
              )}
              <div className="sd-school-name">
                {schoolName}
              </div>
            </div>

            {/* ── Quick Access ── */}
            <div>
              <div className="sd-section-title">Quick Access</div>
              <div className="sd-quick-grid">
                {quickCards.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="sd-quick-card"
                  >
                    <div
                      className="sd-quick-icon"
                      style={{ background: c.iconBg, color: c.iconColor }}
                    >
                      <i className={`fa-solid ${c.icon}`} />
                    </div>
                    <div className="sd-quick-content">
                      <div className="sd-quick-label">{c.label}</div>
                      <div 
                        className="sd-quick-badge" 
                        style={{ 
                          background: c.subBg, 
                          color: c.subColor,
                          padding: c.subBg === 'transparent' ? 0 : undefined
                        }}
                      >
                        {c.sub}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* ── Attendance ── */}
            <div>
              <div className="sd-section-title">Attendance</div>
              <div className="sd-att-container">
                <div className="sd-tabs">
                  {(
                    [
                      ["this_month", "This month"],
                      ["last_month", "Last month"],
                      ["full_year", "Full year"],
                    ] as [Period, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={`sd-tab${period === key ? " active" : ""}`}
                      onClick={() => setPeriod(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                
                {curLoading ? (
                  <div className="sd-spin-center" style={{ padding: "30px 0" }}>
                    <Spinner size={28} color="#4b8ff7" />
                  </div>
                ) : (
                  <DonutChart
                    percentage={pct}
                    present={present}
                    absent={absent}
                    total={total}
                  />
                )}
              </div>
            </div>
          </main>
        )}
      </div>
    </>
  );
}
