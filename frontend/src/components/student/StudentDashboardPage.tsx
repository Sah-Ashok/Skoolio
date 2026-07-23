"use client";

import Link from "next/link";
import React from "react";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";

/* ─── Donut chart ─────────────────────────────────────────────────────────── */
function DonutChart({ pct, present, absent, total }: { pct: number; present: number; absent: number; total: number }) {
  const r       = 52;
  const circ    = 2 * Math.PI * r;
  const hasData = total > 0;

  // Use pct for arcs (already computed correctly by the backend summary)
  const presArc = hasData ? (pct / 100) * circ : 0;
  const absArc  = hasData ? circ - presArc      : 0;
  // Present arc starts at 12 o'clock; absent arc starts where present ends
  const absDeg  = pct * 3.6 - 90; // pct * (360/100) - 90

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      {/* donut */}
      <div style={{ flexShrink: 0, position: "relative" }}>
        <svg viewBox="0 0 140 140" width={120} height={120}>
          {/* track */}
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
          {hasData && (
            <>
              {/* absent — starts where present ends */}
              {absent > 0 && (
                <circle cx="70" cy="70" r={r} fill="none" stroke="#ff9a9e" strokeWidth="18"
                  strokeDasharray={`${absArc} ${presArc}`}
                  strokeDashoffset={0} strokeLinecap="butt"
                  style={{ transform: `rotate(${absDeg}deg)`, transformOrigin: "70px 70px" }} />
              )}
              {/* present — always starts at 12 o'clock */}
              {present > 0 && (
                <circle cx="70" cy="70" r={r} fill="none" stroke="#4b8ff7" strokeWidth="18"
                  strokeDasharray={`${presArc} ${absArc}`}
                  strokeDashoffset={0} strokeLinecap="butt"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "70px 70px" }} />
              )}
            </>
          )}
        </svg>
        {/* centre text */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          {hasData ? (
            <>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", lineHeight: 1 }}>{pct}%</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginTop: 2 }}>present</span>
            </>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textAlign: "center", padding: "0 8px" }}>No data yet</span>
          )}
        </div>
      </div>

      {/* legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { color: "#4b8ff7", label: "Present", value: `${present} days` },
          { color: "#ff9a9e", label: "Absent",  value: `${absent} days`  },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0, marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginTop: 1 }}>{item.value}</div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
          {total > 0 ? `Out of ${total} working days` : "Attendance not marked yet"}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────────────── */
type Period = "this_month" | "last_month" | "full_year";

export default function StudentDashboardPage() {
  const { user } = useAppSelector(s => s.auth);
  const { data: me, loading: meLoading } = useApi<any>("/auth/me");
  const { data: activeYear } = useApi<any>("/academic-years/active");

  // ── Hostel & transport for this student ──
  const { data: hostelData }    = useApi<any>(me?.id ? `/hostel/students/${me.id}`    : null, [me?.id]);
  const { data: transportData } = useApi<any>(me?.id ? `/transport/students/${me.id}` : null, [me?.id]);

  const today    = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd   = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];
  const yearStart      = activeYear?.start_date || `${today.getFullYear()}-04-01`;

  const { data: attThis, loading: loadThis } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${thisMonthStart}&end_date=${todayStr}` : "",
    [activeYear?.id]
  );
  const { data: attLast, loading: loadLast } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${lastMonthStart}&end_date=${lastMonthEnd}` : "",
    [activeYear?.id]
  );
  const { data: attYear, loading: loadYear } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${yearStart}&end_date=${todayStr}` : "",
    [activeYear?.id]
  );

  const { data: feeCollections } = useApi<any[]>(
    activeYear?.id ? `/fees/me/collections?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );
  const pendingFees = (feeCollections || []).filter(f => f.status !== "paid");
  const totalDue    = pendingFees.reduce((s, f) => s + Number(f.remaining_amount || 0), 0);
  const fmtINR      = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const hour       = today.getHours();
  const greetWord  = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const greetIcon  = hour < 12 ? "⛅" : hour < 17 ? "☀️" : "🌙";
  const firstName  = (me?.full_name || user?.full_name || "Student").split(" ")[0];
  const schoolName = me?.school_name || user?.school_name || "Your School";
  const schoolLogo = (me as any)?.school_logo || (user as any)?.school_logo || null;

  const [period, setPeriod] = React.useState<Period>("this_month");

  const attMap = {
    this_month: { data: attThis, loading: loadThis },
    last_month: { data: attLast, loading: loadLast },
    full_year:  { data: attYear, loading: loadYear },
  };
  const { data: curAtt, loading: curLoading } = attMap[period];

  // ── FIXED: correct field names from the API response ──
  const pct     = Math.round(Number(curAtt?.attendance_percentage ?? 0));
  const present = Number(curAtt?.total_present      ?? 0);
  const absent  = Number(curAtt?.total_absent       ?? 0);
  const total   = Number(curAtt?.total_working_days ?? 0);

  const quickCards = [
    {
      href: "/student/fees",
      icon: "fa-money-bill-wave",
      iconBg: "#fef3c7", iconColor: "#d97706",
      label: "My Fees",
      sub: totalDue > 0 ? fmtINR(totalDue) + " due" : "No dues",
      subBg: totalDue > 0 ? "#ffedd5" : "transparent",
      subColor: totalDue > 0 ? "#ea580c" : "#94a3b8",
    },
    {
      href: "/student/results",
      icon: "fa-file-lines",
      iconBg: "#dcfce7", iconColor: "#16a34a",
      label: "Exam Results",
      sub: "Term 1 out",
      subBg: "#dcfce7", subColor: "#16a34a",
    },
    {
      href: "/student/profile",
      icon: "fa-user",
      iconBg: "#f3e8ff", iconColor: "#9333ea",
      label: "My Profile",
      sub: me?.admission_number || "—",
      subBg: "transparent", subColor: "#94a3b8",
    },
    {
      href: "/student/calendar",
      icon: "fa-calendar-days",
      iconBg: "#ffe4e6", iconColor: "#e11d48",
      label: "Calendar",
      sub: "2 events",
      subBg: "transparent", subColor: "#94a3b8",
    },
  ];

  return (
    <>
      <style>{`
        .sd-page { min-height:100vh; background:#f6f8fa; font-family:'Nunito','Inter',sans-serif; display:flex; flex-direction:column; }

        .sd-topbar { background:#fff; height:64px; display:flex; align-items:center; justify-content:space-between; padding:0 28px; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:50; box-shadow:0 1px 6px rgba(37,52,63,0.06); }
        .sd-topbar-greeting { font-size:16px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px; }

        .sd-school-bar { background:#fff; border-bottom:1px solid #e2e8f0; padding:10px 28px; display:flex; align-items:center; gap:12px; }
        .sd-school-bar-logo { width:36px; height:36px; border-radius:50%; object-fit:cover; background:#f1f5f9; border:1px solid #e2e8f0; flex-shrink:0; }
        .sd-school-bar-name { font-size:14px; font-weight:800; color:#1e293b; }
        .sd-school-bar-fallback { width:36px; height:36px; border-radius:50%; background:#fff1df; color:#c2410c; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; flex-shrink:0; }

        .sd-mobile-topbar { display:none; }
        .sd-mobile-logo-img { height:30px; object-fit:contain; }
        .sd-mobile-logo-text { font-size:22px; font-weight:900; color:#25343F; letter-spacing:-0.5px; }
        .sd-mobile-logo-text em { font-style:normal; color:#FF9B51; }

        .sd-content { padding:24px; flex:1; display:flex; flex-direction:column; gap:20px; max-width:600px; margin:0 auto; width:100%; }

        .sd-mobile-greeting { display:none; font-size:18px; font-weight:800; color:#0f172a; align-items:center; gap:8px; }

        .sd-school-block { display:none; align-items:center; gap:14px; }
        .sd-school-logo  { width:68px; height:68px; border-radius:50%; object-fit:cover; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
        .sd-school-logo-fallback { width:68px; height:68px; border-radius:50%; background:#fff1df; color:#c2410c; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:900; flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
        .sd-school-name { font-family:'Playfair Display',Georgia,serif; font-size:26px; font-weight:700; color:#0f172a; line-height:1.2; }

        .sd-section-label { font-size:10px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; color:#94a3b8; margin-bottom:12px; }

        .sd-quick-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .sd-quick-card { background:#fff; border-radius:16px; padding:18px; text-decoration:none; display:flex; flex-direction:column; gap:14px; box-shadow:0 2px 12px rgba(0,0,0,0.04); transition:transform 0.2s,box-shadow 0.2s; }
        .sd-quick-card:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,0.07); }
        .sd-quick-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
        .sd-quick-label { font-size:14px; font-weight:800; color:#334155; }
        .sd-quick-badge { font-size:11px; font-weight:700; padding:3px 8px; border-radius:6px; display:inline-block; width:fit-content; margin-top:3px; }

        .sd-att-card { background:#fff; border-radius:16px; padding:20px; box-shadow:0 2px 12px rgba(0,0,0,0.04); }
        .sd-tabs { display:flex; gap:8px; margin-bottom:20px; }
        .sd-tab { flex:1; padding:8px 0; border-radius:8px; font-size:12px; font-weight:700; color:#64748b; border:1px solid #e2e8f0; background:#fff; cursor:pointer; text-align:center; transition:all 0.18s; font-family:'Nunito','Inter',sans-serif; }
        .sd-tab.sd-tab-active { background:#1e293b; color:#fff; border-color:#1e293b; }

        .sd-topbar-avatar { width:36px; height:36px; border-radius:50%; background:#f1f5f9; color:#64748b; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }

        @media (max-width: 768px) {
          .sd-topbar    { display:none; }
          .sd-school-bar { display:none; }

          .sd-mobile-topbar {
            display:flex; align-items:center; justify-content:center;
            padding:14px 20px; background:#fff;
            border-bottom:1.5px solid #e2e8f0;
            position:sticky; top:0; z-index:50;
          }

          .sd-content { padding:20px; gap:18px; }
          .sd-mobile-greeting { display:flex; }
          .sd-school-block    { display:flex; }
          .sd-quick-grid { gap:10px; }
          .sd-quick-card { padding:14px; gap:10px; }
          .sd-att-card { padding:16px; }
          .sd-tabs { gap:6px; }
          .sd-tab  { font-size:11px; padding:7px 0; }
        }

        @media (max-width: 380px) {
          .sd-school-name { font-size:20px; }
          .sd-quick-label { font-size:13px; }
        }
      `}</style>

      <div className="sd-page">

        {/* ── DESKTOP TOPBAR ── */}
        <header className="sd-topbar">
          <div className="sd-topbar-greeting">
            <span>{greetIcon}</span>
            {greetWord} , {firstName}
          </div>
          <div className="sd-topbar-avatar">
            <i className="fa-solid fa-user" />
          </div>
        </header>

        {/* ── DESKTOP SCHOOL BAR ── */}
        <div className="sd-school-bar">
          {schoolLogo
            ? <img src={schoolLogo} alt="School" className="sd-school-bar-logo" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            : <div className="sd-school-bar-fallback">{schoolName.charAt(0)}</div>
          }
          <span className="sd-school-bar-name">{schoolName}</span>
        </div>

        {/* ── MOBILE TOPBAR ── */}
        <header className="sd-mobile-topbar">
          <img
            src="/Logo.png"
            alt="Skoolio"
            className="sd-mobile-logo-img"
            onError={e => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (e.currentTarget.nextElementSibling as HTMLElement).style.display = "block";
            }}
          />
          <span className="sd-mobile-logo-text" style={{ display: "none" }}>
            <em>Skoo</em>lio
          </span>
        </header>

        {meLoading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "80px 0" }}>
            <Spinner size={32} color="#4b8ff7" />
          </div>
        ) : (
          <main className="sd-content">

            {/* Mobile greeting */}
            <div className="sd-mobile-greeting">
              <span>{greetIcon}</span>
              {greetWord} , {firstName}
            </div>

            {/* School logo + name (mobile) */}
            <div className="sd-school-block">
              {schoolLogo
                ? <img src={schoolLogo} alt="School" className="sd-school-logo" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                : <div className="sd-school-logo-fallback">{schoolName.charAt(0)}</div>
              }
              <div className="sd-school-name">{schoolName}</div>
            </div>

            {/* Quick access */}
            <div>
              <div className="sd-section-label">Quick Access</div>
              <div className="sd-quick-grid">
                {quickCards.map(c => (
                  <Link key={c.href} href={c.href} className="sd-quick-card">
                    <div className="sd-quick-icon" style={{ background: c.iconBg, color: c.iconColor }}>
                      <i className={`fa-solid ${c.icon}`} />
                    </div>
                    <div>
                      <div className="sd-quick-label">{c.label}</div>
                      <div
                        className="sd-quick-badge"
                        style={{
                          background: c.subBg,
                          color: c.subColor,
                          padding: c.subBg === "transparent" ? "3px 0" : undefined,
                        }}
                      >
                        {c.sub}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Attendance */}
            <div>
              <div className="sd-section-label">Attendance</div>
              <div className="sd-att-card">
                <div className="sd-tabs">
                  {([
                    ["this_month", "This month"],
                    ["last_month", "Last month"],
                    ["full_year",  "Full year" ],
                  ] as [Period, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      className={`sd-tab${period === key ? " sd-tab-active" : ""}`}
                      onClick={() => setPeriod(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {curLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                    <Spinner size={28} color="#4b8ff7" />
                  </div>
                ) : (
                  <DonutChart pct={pct} present={present} absent={absent} total={total} />
                )}
              </div>
            </div>

            {/* Hostel Status */}
            {hostelData && hostelData.status === "active" && (
              <div>
                <div className="sd-section-label">Hostel</div>
                <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ede9fe", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      <i className="fa-solid fa-building" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#1e293b" }}>{hostelData.hostel_name || "Hostel"}</div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 2 }}>
                        Room {hostelData.room_number} · Floor {hostelData.floor} · {(hostelData.room_type || "").replace("_", " ").toUpperCase()}
                      </div>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 11.5, fontWeight: 800, background: "#dcfce7", color: "#16a34a" }}>Active</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", marginBottom: 3 }}>MONTHLY FEE</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b" }}>₹{Number(hostelData.monthly_fee || 0).toLocaleString()}</div>
                    </div>
                    <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", marginBottom: 3 }}>JOINED</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{hostelData.joining_date?.slice(0, 10) || "—"}</div>
                    </div>
                  </div>
                  {hostelData.warden_name && (
                    <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="fa-solid fa-user-shield" style={{ color: "#FF9B51" }} />
                      Warden: <strong style={{ color: "#1e293b" }}>{hostelData.warden_name}</strong>
                      {hostelData.warden_phone && <span style={{ marginLeft: 4 }}>· {hostelData.warden_phone}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transport Status */}
            {transportData && transportData.status === "active" && (
              <div>
                <div className="sd-section-label">Transport</div>
                <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      <i className="fa-solid fa-bus" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#1e293b" }}>{transportData.route_name || "Route"}</div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 2 }}>
                        {transportData.stop_name ? `Stop: ${transportData.stop_name}` : "Assigned"}
                        {transportData.pickup_time ? ` · Pickup ${transportData.pickup_time}` : ""}
                      </div>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 11.5, fontWeight: 800, background: "#dcfce7", color: "#16a34a" }}>Active</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", marginBottom: 3 }}>MONTHLY FEE</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b" }}>₹{Number(transportData.monthly_fee || 0).toLocaleString()}</div>
                    </div>
                    <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", marginBottom: 3 }}>VEHICLE</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>{transportData.vehicle_number || "—"}</div>
                    </div>
                  </div>
                  {transportData.driver_name && (
                    <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="fa-solid fa-id-card" style={{ color: "#FF9B51" }} />
                      Driver: <strong style={{ color: "#1e293b" }}>{transportData.driver_name}</strong>
                      {transportData.driver_phone && <span style={{ marginLeft: 4 }}>· {transportData.driver_phone}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ height: 8 }} />

          </main>
        )}
      </div>
    </>
  );
}
