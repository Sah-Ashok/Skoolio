"use client";

import Link from "next/link";
import React from "react";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";

/* ══════════════════════════════════════════════════════════
   Mini Donut
══════════════════════════════════════════════════════════ */
function MiniDonut({ pct }: { pct: number }) {
  const r = 22, circ = 2 * Math.PI * r;
  const arc = (pct / 100) * circ;
  const color = pct >= 85 ? "#22c55e" : pct >= 70 ? "#f97316" : "#ef4444";
  return (
    <svg width={54} height={54} viewBox="0 0 54 54">
      <circle cx="27" cy="27" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
      {pct > 0 && (
        <circle cx="27" cy="27" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round" />
      )}
      <text x="27" y="31" textAnchor="middle" fontSize="11" fontWeight="800" fill={pct > 0 ? color : "#94a3b8"}>
        {pct > 0 ? `${pct}%` : "—"}
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   Big Donut for Attendance section
══════════════════════════════════════════════════════════ */
function BigDonut({ pct, present, absent, late, leave, total }: {
  pct: number; present: number; absent: number; late: number; leave: number; total: number;
}) {
  const r = 58, circ = 2 * Math.PI * r;
  const arc  = (pct / 100) * circ;
  const color = pct >= 85 ? "#22c55e" : pct >= 70 ? "#f97316" : "#ef4444";
  const segments = [
    { val: present, color: "#6366f1", label: "Present" },
    { val: absent,  color: "#f43f5e", label: "Absent"  },
    { val: late,    color: "#fb923c", label: "Late"     },
    { val: leave,   color: "#a78bfa", label: "Leave"    },
  ].filter(s => s.val > 0);

  return (
    <div style={{ display:"flex", alignItems:"center", gap:28, flexWrap:"wrap" }}>
      <div style={{ position:"relative", flexShrink:0 }}>
        <svg width={140} height={140} viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
          {total > 0 && (
            <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="16"
              strokeDasharray={`${arc} ${circ - arc}`}
              strokeDashoffset={circ * 0.25}
              strokeLinecap="round" />
          )}
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:26, fontWeight:900, color: total > 0 ? color : "#94a3b8", lineHeight:1 }}>
            {total > 0 ? `${pct}%` : "—"}
          </span>
          <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", marginTop:3 }}>attendance</span>
        </div>
      </div>
      <div style={{ flex:1, minWidth:140, display:"flex", flexDirection:"column", gap:8 }}>
        {[
          { color:"#6366f1", label:"Present", value:present },
          { color:"#f43f5e", label:"Absent",  value:absent  },
          { color:"#fb923c", label:"Late",     value:late    },
          { color:"#a78bfa", label:"Leave",    value:leave   },
        ].map(item => (
          <div key={item.label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:item.color, flexShrink:0 }} />
              <span style={{ fontSize:12, fontWeight:600, color:"#64748b" }}>{item.label}</span>
            </div>
            <span style={{ fontSize:14, fontWeight:800, color:"#1e293b" }}>{item.value}d</span>
          </div>
        ))}
        <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600, marginTop:4, paddingTop:8, borderTop:"1px solid #f1f5f9" }}>
          {total > 0 ? `${total} working days total` : "Not yet marked"}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════ */
type Period = "this_month" | "last_month" | "full_year";

export default function StudentDashboardPage() {
  const { user }                         = useAppSelector(s => s.auth);
  const { data: me, loading: meLoading } = useApi<any>("/auth/me");
  const { data: activeYear }             = useApi<any>("/academic-years/active");

  /* attendance */
  const today          = new Date();
  const todayStr       = today.toISOString().split("T")[0];
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth()-1, 1).toISOString().split("T")[0];
  const lastMonthEnd   = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];
  const yearStart      = activeYear?.start_date || `${today.getFullYear()}-01-01`;

  const { data: attThis, loading: loadThis } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${thisMonthStart}&end_date=${todayStr}` : "", [activeYear?.id]);
  const { data: attLast, loading: loadLast } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${lastMonthStart}&end_date=${lastMonthEnd}` : "", [activeYear?.id]);
  const { data: attYear, loading: loadYear } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${yearStart}&end_date=${todayStr}` : "", [activeYear?.id]);

  /* fees */
  const { data: feeCollections } = useApi<any[]>(
    activeYear?.id ? `/fees/me/collections?academic_year_id=${activeYear.id}` : "", [activeYear?.id]);
  const pendingFees  = (feeCollections || []).filter(f => f.status !== "paid");
  const totalDue     = pendingFees.reduce((s, f) => s + Number(f.remaining_amount || 0), 0);
  const totalPaid    = (feeCollections || []).filter(f => f.status === "paid").reduce((s, f) => s + Number(f.amount || 0), 0);
  const fmtAmt       = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  /* exam results */
  const { data: myResults } = useApi<any[]>("/exams/me/results");

  /* notices */
  const { data: notices } = useApi<any[]>("/notices/student");

  /* calendar */
  const { data: calendar }      = useApi<any>("/calendar");
  const calendarId              = calendar?.id;
  const { data: calendarEvents } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/events` : "", [calendarId]);

  /* hostel / transport */
  const { data: hostelData }    = useApi<any>(me?.id ? `/hostel/students/${me.id}`    : null, [me?.id]);
  const { data: transportData } = useApi<any>(me?.id ? `/transport/students/${me.id}` : null, [me?.id]);

  /* derived */
  const hour      = today.getHours();
  const greetWord = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const greetIcon = hour < 12 ? "☀️" : hour < 17 ? "🌤️" : "🌙";
  const firstName = (me?.full_name || (user as any)?.full_name || "Student").split(" ")[0];
  const initials  = firstName.slice(0,2).toUpperCase();
  const schoolName = me?.school_name || (user as any)?.school_name || "";

  const [period, setPeriod] = React.useState<Period>("this_month");
  const attMap = { this_month:{data:attThis,loading:loadThis}, last_month:{data:attLast,loading:loadLast}, full_year:{data:attYear,loading:loadYear} };
  const { data: curAtt, loading: curLoading } = attMap[period];

  const present = Number(curAtt?.total_present      ?? 0);
  const absent  = Number(curAtt?.total_absent       ?? 0);
  const late    = Number(curAtt?.total_late         ?? 0);
  const leave   = Number(curAtt?.total_leave        ?? 0);
  const total   = Number(curAtt?.total_working_days ?? 0);
  // Formula: Attendance % = (Working Days - Absent) / Working Days x 100
  // Leave is NOT counted as absent (matches the standard formula)
  const pct = total > 0
    ? Math.max(0, Math.round(((total - absent) / total) * 100))
    : Math.round(Number(curAtt?.attendance_percentage ?? 0));


  /* upcoming events — next 3 within 30 days */
  const upcomingEvents = (calendarEvents || [])
    .filter((e: any) => {
      const d = new Date(e.event_date || e.start_date || e.date);
      return d >= today && d <= new Date(today.getTime() + 30*24*60*60*1000);
    })
    .sort((a: any, b: any) => new Date(a.event_date||a.start_date||a.date).getTime() - new Date(b.event_date||b.start_date||b.date).getTime())
    .slice(0, 4);

  /* latest results — last 3 */
  const latestResults = (myResults || []).slice(0, 3);

  /* active notices — latest 3 */
  const activeNotices = (notices || []).filter((n:any) => n.is_active !== false).slice(0, 3);

  const pctColor = pct >= 85 ? "#22c55e" : pct >= 70 ? "#f97316" : "#ef4444";
  const pctBg    = pct >= 85 ? "#dcfce7" : pct >= 70 ? "#fff7ed" : "#fee2e2";

  const fmtEventDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day:"2-digit", month:"short" });
  };

  return (
    <>
      <style>{`
        * { box-sizing:border-box; }
        .d-page  { min-height:100vh; background:#f0f2f5; font-family:'Nunito','Inter',sans-serif; }

        /* ── Topbar ── */
        .d-topbar { height:60px; background:#fff; border-bottom:1px solid #e8edf2; display:flex; align-items:center; justify-content:space-between; padding:0 28px; position:sticky; top:0; z-index:50; }
        .d-topbar-left { display:flex; align-items:center; gap:10px; }
        .d-topbar-greeting { font-size:15px; font-weight:800; color:#0f172a; }
        .d-topbar-school { font-size:12px; color:#94a3b8; font-weight:600; }
        .d-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#FF9B51,#f97316); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:900; flex-shrink:0; }

        .d-mob-bar { display:none; height:56px; background:#fff; border-bottom:1.5px solid #e8edf2; align-items:center; justify-content:space-between; padding:0 18px; position:sticky; top:0; z-index:50; }
        .d-mob-logo { font-size:21px; font-weight:900; color:#25343F; letter-spacing:-0.5px; }
        .d-mob-logo em { font-style:normal; color:#FF9B51; }

        /* ── Layout ── */
        .d-wrap  { max-width:1100px; margin:0 auto; padding:24px; display:flex; flex-direction:column; gap:20px; }

        /* ── Hero ── */
        .d-hero  { background:linear-gradient(125deg,#1e293b 0%,#0f172a 100%); border-radius:20px; padding:30px 32px; display:flex; align-items:center; justify-content:space-between; gap:20px; position:relative; overflow:hidden; }
        .d-hero::before { content:''; position:absolute; top:-60px; right:-60px; width:260px; height:260px; border-radius:50%; background:rgba(99,102,241,0.12); pointer-events:none; }
        .d-hero::after  { content:''; position:absolute; bottom:-80px; right:80px; width:180px; height:180px; border-radius:50%; background:rgba(255,155,81,0.08); pointer-events:none; }
        .d-hero-text { display:flex; flex-direction:column; gap:6px; z-index:1; }
        .d-hero-hi   { font-size:13px; font-weight:700; color:rgba(255,255,255,0.45); letter-spacing:.5px; }
        .d-hero-name { font-size:28px; font-weight:900; color:#fff; line-height:1.1; }
        .d-hero-school { font-size:13px; font-weight:600; color:rgba(255,255,255,0.4); margin-top:2px; }
        .d-hero-chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
        .d-chip { padding:5px 12px; border-radius:8px; font-size:11px; font-weight:700; background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); display:flex; align-items:center; gap:6px; border:1px solid rgba(255,255,255,0.1); }
        .d-chip i { color:#FF9B51; font-size:10px; }
        .d-hero-right { display:flex; flex-direction:column; align-items:center; gap:10px; z-index:1; flex-shrink:0; }
        .d-hero-avatar { width:80px; height:80px; border-radius:20px; background:linear-gradient(135deg,#FF9B51,#f97316); color:#fff; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:900; box-shadow:0 8px 28px rgba(255,155,81,0.4); }
        .d-hero-badge { padding:5px 14px; border-radius:20px; font-size:11px; font-weight:800; background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.25); }

        /* ── Two-col layout ── */
        .d-cols { display:grid; grid-template-columns:1fr 340px; gap:20px; align-items:start; }
        .d-col-main { display:flex; flex-direction:column; gap:20px; }
        .d-col-side { display:flex; flex-direction:column; gap:20px; }

        /* ── Section ── */
        .d-section-title { font-size:11px; font-weight:900; letter-spacing:1.4px; text-transform:uppercase; color:#94a3b8; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
        .d-section-title span { font-size:14px; }

        /* ── Cards ── */
        .d-card { background:#fff; border-radius:16px; padding:20px; box-shadow:0 1px 4px rgba(0,0,0,0.05); border:1px solid #e8edf2; }

        /* ── Stat row (3-col) ── */
        .d-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .d-stat { background:#fff; border-radius:14px; padding:16px 18px; box-shadow:0 1px 4px rgba(0,0,0,0.05); border:1px solid #e8edf2; display:flex; flex-direction:column; gap:8px; }
        .d-stat-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
        .d-stat-label { font-size:10px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:.6px; }
        .d-stat-value { font-size:20px; font-weight:900; color:#0f172a; line-height:1; }
        .d-stat-sub   { font-size:11px; font-weight:700; }

        /* ── Quick links ── */
        .d-quick { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
        .d-ql { background:#fff; border-radius:14px; padding:16px 12px; text-decoration:none; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,0.05); border:1px solid #e8edf2; transition:all .18s; }
        .d-ql:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(0,0,0,0.09); }
        .d-ql-icon { width:44px; height:44px; border-radius:13px; display:flex; align-items:center; justify-content:center; font-size:18px; }
        .d-ql-label { font-size:12px; font-weight:800; color:#334155; line-height:1.2; }

        /* ── Tabs ── */
        .d-tabs { display:flex; background:#f1f5f9; border-radius:10px; padding:3px; gap:3px; margin-bottom:18px; }
        .d-tab { flex:1; padding:7px 0; border-radius:8px; font-size:12px; font-weight:700; color:#64748b; border:none; background:transparent; cursor:pointer; font-family:inherit; transition:all .15s; }
        .d-tab.on { background:#fff; color:#1e293b; box-shadow:0 1px 4px rgba(0,0,0,0.08); }

        /* ── Notice item ── */
        .d-notice { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid #f1f5f9; }
        .d-notice:last-child { border-bottom:none; padding-bottom:0; }
        .d-notice-bar { width:3px; border-radius:3px; flex-shrink:0; align-self:stretch; min-height:32px; }
        .d-notice-title { font-size:13px; font-weight:800; color:#1e293b; }
        .d-notice-body  { font-size:12px; color:#64748b; margin-top:3px; line-height:1.45;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .d-notice-meta  { font-size:10px; color:#94a3b8; font-weight:700; margin-top:5px; }

        /* ── Event item ── */
        .d-event { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #f1f5f9; }
        .d-event:last-child { border-bottom:none; padding-bottom:0; }
        .d-event-date { width:42px; height:42px; border-radius:10px; background:#f1f5f9; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; }
        .d-event-day   { font-size:15px; font-weight:900; color:#1e293b; line-height:1; }
        .d-event-month { font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; }
        .d-event-name { font-size:13px; font-weight:800; color:#1e293b; }
        .d-event-type { font-size:11px; color:#64748b; font-weight:600; margin-top:2px; }

        /* ── Result item ── */
        .d-result { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9; gap:10px; }
        .d-result:last-child { border-bottom:none; padding-bottom:0; }
        .d-result-left { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
        .d-result-sub  { font-size:13px; font-weight:800; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .d-result-exam { font-size:11px; color:#64748b; font-weight:600; }
        .d-result-marks { font-size:16px; font-weight:900; }
        .d-result-grade { font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px; background:#f1f5f9; color:#64748b; }

        /* ── Fee summary ── */
        .d-fee-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9; }
        .d-fee-row:last-child { border-bottom:none; padding-bottom:0; }

        /* ── See all link ── */
        .d-see-all { display:flex; align-items:center; justify-content:flex-end; margin-top:12px; }
        .d-see-all a { font-size:12px; font-weight:800; color:#6366f1; text-decoration:none; display:flex; align-items:center; gap:4px; }

        /* ── Responsive ── */
        @media(max-width:900px) {
          .d-cols  { grid-template-columns:1fr; }
          .d-quick { grid-template-columns:repeat(4,1fr); }
          .d-stats { grid-template-columns:repeat(3,1fr); }
        }
        @media(max-width:700px) {
          .d-topbar { display:none; }
          .d-mob-bar { display:flex; }
          .d-wrap { padding:14px; gap:14px; }
          .d-hero { padding:22px 18px; }
          .d-hero-name { font-size:22px; }
          .d-hero-avatar { width:64px; height:64px; font-size:22px; border-radius:16px; }
          .d-quick { grid-template-columns:repeat(4,1fr); gap:8px; }
          .d-ql { padding:12px 8px; gap:8px; }
          .d-ql-icon { width:38px; height:38px; font-size:15px; border-radius:11px; }
          .d-ql-label { font-size:11px; }
          .d-stats { grid-template-columns:repeat(3,1fr); gap:8px; }
          .d-stat { padding:14px 12px; }
          .d-stat-value { font-size:18px; }
          .d-card { padding:16px; }
        }
        @media(max-width:420px) {
          .d-hero-chips { display:none; }
          .d-quick { grid-template-columns:repeat(2,1fr); }
          .d-stats { grid-template-columns:repeat(2,1fr); }
        }
      `}</style>

      <div className="d-page">

        {/* Desktop topbar */}
        <header className="d-topbar">
          <div className="d-topbar-left">
            <div className="d-avatar">{initials}</div>
            <div>
              <div className="d-topbar-greeting">{greetIcon} {greetWord}, {firstName}!</div>
              {schoolName && <div className="d-topbar-school">{schoolName}</div>}
            </div>
          </div>
          <Link href="/student/profile" style={{ textDecoration:"none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:10, background:"#f8fafc", border:"1px solid #e8edf2", cursor:"pointer" }}>
              <i className="fa-solid fa-user" style={{ fontSize:12, color:"#94a3b8" }} />
              <span style={{ fontSize:12, fontWeight:700, color:"#64748b" }}>My Profile</span>
            </div>
          </Link>
        </header>

        {/* Mobile topbar */}
        <header className="d-mob-bar">
          <div className="d-mob-logo"><em>Skoo</em>lio</div>
          <div className="d-avatar">{initials}</div>
        </header>

        {meLoading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:"80px 0" }}>
            <Spinner size={32} color="#6366f1" />
          </div>
        ) : (
          <main className="d-wrap">

            {/* ══ HERO ══ */}
            <div className="d-hero">
              <div className="d-hero-text">
                <div className="d-hero-hi">{greetIcon} &nbsp;{greetWord}</div>
                <div className="d-hero-name">{me?.full_name || firstName}</div>
                <div className="d-hero-school">{schoolName}</div>
                <div className="d-hero-chips">
                  {me?.admission_number && (
                    <div className="d-chip"><i className="fa-solid fa-id-card"/>Adm# {me.admission_number}</div>
                  )}
                  {activeYear?.year_name && (
                    <div className="d-chip"><i className="fa-solid fa-calendar"/>{ activeYear.year_name}</div>
                  )}
                  {me?.class_name && (
                    <div className="d-chip"><i className="fa-solid fa-school"/>{me.class_name}{me?.section_name ? ` · ${me.section_name}` : ""}</div>
                  )}
                  {me?.roll_number && (
                    <div className="d-chip"><i className="fa-solid fa-list-ol"/>Roll #{me.roll_number}</div>
                  )}
                </div>
              </div>
              <div className="d-hero-right">
                <div className="d-hero-avatar">{initials}</div>
                {me?.status && (
                  <div className="d-hero-badge" style={{
                    background: me.status === "active" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                    color:      me.status === "active" ? "#4ade80" : "#f87171",
                    border:     `1px solid ${me.status === "active" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                  }}>{me.status}</div>
                )}
              </div>
            </div>

            {/* ══ STAT CARDS ══ */}
            <div className="d-stats">
              {/* Attendance */}
              <div className="d-stat">
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div className="d-stat-label">Attendance</div>
                    <div className="d-stat-value" style={{ color: total > 0 ? pctColor : "#94a3b8" }}>
                      {total > 0 ? `${pct}%` : "—"}
                    </div>
                    <div className="d-stat-sub" style={{ color: pctColor, marginTop:4, background: pctBg, padding:"2px 8px", borderRadius:6, display:"inline-block" }}>
                      {total > 0 ? (pct >= 75 ? "Good standing" : "Needs attention") : "No data"}
                    </div>
                  </div>
                  <MiniDonut pct={pct} />
                </div>
              </div>

              {/* Fees due */}
              <div className="d-stat">
                <div className="d-stat-icon" style={{ background: totalDue > 0 ? "#fff7ed" : "#f0fdf4", color: totalDue > 0 ? "#ea580c" : "#16a34a" }}>
                  <i className="fa-solid fa-indian-rupee-sign" />
                </div>
                <div className="d-stat-label">Fees Due</div>
                <div className="d-stat-value" style={{ color: totalDue > 0 ? "#ea580c" : "#16a34a", fontSize:totalDue > 9999 ? 16 : 20 }}>
                  {totalDue > 0 ? fmtAmt(totalDue) : "Clear"}
                </div>
                <div className="d-stat-sub" style={{ color: totalDue > 0 ? "#ea580c" : "#16a34a" }}>
                  {totalDue > 0 ? `${pendingFees.length} pending` : "All paid ✓"}
                </div>
              </div>

              {/* Notices */}
              <div className="d-stat">
                <div className="d-stat-icon" style={{ background:"#eff6ff", color:"#3b82f6" }}>
                  <i className="fa-solid fa-bell" />
                </div>
                <div className="d-stat-label">Notices</div>
                <div className="d-stat-value">{activeNotices.length || "—"}</div>
                <div className="d-stat-sub" style={{ color:"#64748b" }}>
                  {activeNotices.length > 0 ? "unread notices" : "Nothing new"}
                </div>
              </div>
            </div>

            {/* ══ QUICK LINKS ══ */}
            <div>
              <div className="d-section-title"><span>⚡</span> Quick Access</div>
              <div className="d-quick">
                {[
                  { href:"/student/attendance",      icon:"fa-user-check",       bg:"linear-gradient(135deg,#6366f1,#818cf8)", label:"Attendance"      },
                  { href:"/student/fees",             icon:"fa-money-bill-wave",  bg:"linear-gradient(135deg,#f97316,#fb923c)", label:"My Fees"         },
                  { href:"/student/results",          icon:"fa-file-lines",       bg:"linear-gradient(135deg,#10b981,#34d399)", label:"Results"         },
                  { href:"/student/calendar",         icon:"fa-calendar-days",    bg:"linear-gradient(135deg,#e11d48,#fb7185)", label:"Calendar"        },
                  { href:"/student/profile",          icon:"fa-user",             bg:"linear-gradient(135deg,#8b5cf6,#a78bfa)", label:"Profile"         },
                  { href:"/student/submit-payment",   icon:"fa-paper-plane",      bg:"linear-gradient(135deg,#0ea5e9,#38bdf8)", label:"Pay Now"         },
                  { href:"/student/bank-details",     icon:"fa-building-columns", bg:"linear-gradient(135deg,#64748b,#94a3b8)", label:"Bank Info"       },
                  { href:"/student/my-submissions",   icon:"fa-receipt",          bg:"linear-gradient(135deg,#d97706,#fbbf24)", label:"My Payments"     },
                ].map(c => (
                  <Link key={c.href} href={c.href} className="d-ql">
                    <div className="d-ql-icon" style={{ background:c.bg }}>
                      <i className={`fa-solid ${c.icon}`} style={{ color:"#fff" }} />
                    </div>
                    <div className="d-ql-label">{c.label}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* ══ TWO-COL MAIN CONTENT ══ */}
            <div className="d-cols">

              {/* LEFT column */}
              <div className="d-col-main">

                {/* ── Attendance detail ── */}
                <div>
                  <div className="d-section-title"><span>📊</span> Attendance Overview</div>
                  <div className="d-card">
                    <div className="d-tabs">
                      {([["this_month","This Month"],["last_month","Last Month"],["full_year","Full Year"]] as [Period,string][]).map(([k,l]) => (
                        <button key={k} className={`d-tab${period===k?" on":""}`} onClick={() => setPeriod(k)}>{l}</button>
                      ))}
                    </div>
                    {curLoading ? (
                      <div style={{ display:"flex", justifyContent:"center", padding:"32px 0" }}><Spinner size={28} color="#6366f1" /></div>
                    ) : (
                      <BigDonut pct={pct} present={present} absent={absent} late={late} leave={leave} total={total} />
                    )}
                    <div className="d-see-all">
                      <Link href="/student/attendance">Full calendar <i className="fa-solid fa-arrow-right" style={{ fontSize:10 }} /></Link>
                    </div>
                  </div>
                </div>

                {/* ── Exam Results ── */}
                {latestResults.length > 0 && (
                  <div>
                    <div className="d-section-title"><span>🎓</span> Recent Results</div>
                    <div className="d-card">
                      {latestResults.map((r: any, i: number) => {
                        const score = Number(r.marks_obtained ?? r.obtained_marks ?? 0);
                        const total = Number(r.total_marks ?? r.max_marks ?? 100);
                        const pct   = total > 0 ? Math.round((score/total)*100) : 0;
                        const gc    = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f97316" : "#ef4444";
                        return (
                          <div key={i} className="d-result">
                            <div className="d-result-left">
                              <div className="d-result-sub">{r.subject_name || r.subject || "Subject"}</div>
                              <div className="d-result-exam">{r.exam_name || r.exam || ""}</div>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                              <div className="d-result-marks" style={{ color:gc }}>{score}/{total}</div>
                              <div className="d-result-grade">{r.grade || `${pct}%`}</div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="d-see-all">
                        <Link href="/student/results">All results <i className="fa-solid fa-arrow-right" style={{ fontSize:10 }} /></Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Fee Summary ── */}
                {(feeCollections || []).length > 0 && (
                  <div>
                    <div className="d-section-title"><span>💳</span> Fee Summary</div>
                    <div className="d-card">
                      {/* Summary bar */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                        <div style={{ padding:"12px 14px", borderRadius:12, background:"#f0fdf4", border:"1px solid #bbf7d0" }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#16a34a", marginBottom:4 }}>TOTAL PAID</div>
                          <div style={{ fontSize:18, fontWeight:900, color:"#16a34a" }}>{fmtAmt(totalPaid)}</div>
                        </div>
                        <div style={{ padding:"12px 14px", borderRadius:12, background: totalDue > 0 ? "#fff7ed" : "#f0fdf4", border:`1px solid ${totalDue > 0 ? "#fed7aa" : "#bbf7d0"}` }}>
                          <div style={{ fontSize:10, fontWeight:800, color: totalDue > 0 ? "#ea580c" : "#16a34a", marginBottom:4 }}>OUTSTANDING</div>
                          <div style={{ fontSize:18, fontWeight:900, color: totalDue > 0 ? "#ea580c" : "#16a34a" }}>{totalDue > 0 ? fmtAmt(totalDue) : "Clear"}</div>
                        </div>
                      </div>
                      {/* Pending list */}
                      {pendingFees.slice(0,3).map((f: any, i: number) => (
                        <div key={i} className="d-fee-row">
                          <div>
                            <div style={{ fontSize:13, fontWeight:800, color:"#1e293b" }}>{f.fee_type || f.description || "Fee"}</div>
                            <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600, marginTop:2 }}>Due: {f.due_date?.slice(0,10) || "—"}</div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:14, fontWeight:900, color:"#ea580c" }}>{fmtAmt(Number(f.remaining_amount||0))}</span>
                            <span style={{ padding:"2px 8px", borderRadius:6, fontSize:10, fontWeight:800, background:"#fff7ed", color:"#ea580c" }}>Due</span>
                          </div>
                        </div>
                      ))}
                      <div className="d-see-all">
                        <Link href="/student/fees">All fees <i className="fa-solid fa-arrow-right" style={{ fontSize:10 }} /></Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Hostel ── */}
                {hostelData?.status === "active" && (
                  <div>
                    <div className="d-section-title"><span>🏠</span> Hostel</div>
                    <div className="d-card">
                      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                        <div style={{ width:44, height:44, borderRadius:12, background:"#ede9fe", color:"#7c3aed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                          <i className="fa-solid fa-building" />
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:15, fontWeight:900, color:"#1e293b" }}>{hostelData.hostel_name || "Hostel"}</div>
                          <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>Room {hostelData.room_number} · {(hostelData.room_type||"").replace("_"," ")}</div>
                        </div>
                        <span style={{ padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:800, background:"#dcfce7", color:"#16a34a" }}>Active</span>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        <div style={{ padding:"10px 12px", borderRadius:10, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", marginBottom:3 }}>MONTHLY FEE</div>
                          <div style={{ fontSize:16, fontWeight:900, color:"#1e293b" }}>₹{Number(hostelData.monthly_fee||0).toLocaleString()}</div>
                        </div>
                        <div style={{ padding:"10px 12px", borderRadius:10, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", marginBottom:3 }}>WARDEN</div>
                          <div style={{ fontSize:13, fontWeight:800, color:"#1e293b" }}>{hostelData.warden_name || "—"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Transport ── */}
                {transportData?.status === "active" && (
                  <div>
                    <div className="d-section-title"><span>🚌</span> Transport</div>
                    <div className="d-card">
                      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                        <div style={{ width:44, height:44, borderRadius:12, background:"#fef3c7", color:"#d97706", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                          <i className="fa-solid fa-bus" />
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:15, fontWeight:900, color:"#1e293b" }}>{transportData.route_name || "Route"}</div>
                          <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>
                            {transportData.stop_name ? `Stop: ${transportData.stop_name}` : "Assigned"}
                            {transportData.pickup_time ? ` · Pickup ${transportData.pickup_time}` : ""}
                          </div>
                        </div>
                        <span style={{ padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:800, background:"#dcfce7", color:"#16a34a" }}>Active</span>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        <div style={{ padding:"10px 12px", borderRadius:10, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", marginBottom:3 }}>MONTHLY FEE</div>
                          <div style={{ fontSize:16, fontWeight:900, color:"#1e293b" }}>₹{Number(transportData.monthly_fee||0).toLocaleString()}</div>
                        </div>
                        <div style={{ padding:"10px 12px", borderRadius:10, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", marginBottom:3 }}>DRIVER</div>
                          <div style={{ fontSize:13, fontWeight:800, color:"#1e293b" }}>{transportData.driver_name || "—"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>{/* end left col */}

              {/* RIGHT sidebar */}
              <div className="d-col-side">

                {/* ── Notices ── */}
                <div>
                  <div className="d-section-title"><span>📢</span> Notices</div>
                  <div className="d-card">
                    {activeNotices.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"20px 0", color:"#94a3b8", fontSize:13, fontWeight:700 }}>
                        <i className="fa-solid fa-bell-slash" style={{ fontSize:24, marginBottom:8, display:"block" }} />
                        No notices right now
                      </div>
                    ) : (
                      activeNotices.map((n: any, i: number) => {
                        const pc: Record<string,string> = { high:"#ef4444", urgent:"#dc2626", medium:"#f97316", low:"#6366f1" };
                        const c = pc[n.priority] || "#6366f1";
                        return (
                          <div key={n.id||i} className="d-notice">
                            <div className="d-notice-bar" style={{ background:c }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6 }}>
                                <div className="d-notice-title">{n.title}</div>
                                {n.priority && (
                                  <span style={{ fontSize:9, fontWeight:800, padding:"2px 6px", borderRadius:4, background:`${c}18`, color:c, flexShrink:0, textTransform:"capitalize" }}>{n.priority}</span>
                                )}
                              </div>
                              {n.message && <div className="d-notice-body">{n.message}</div>}
                              <div className="d-notice-meta">
                                {n.created_at ? new Date(n.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short"}) : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ── Upcoming Events ── */}
                <div>
                  <div className="d-section-title"><span>🗓️</span> Upcoming Events</div>
                  <div className="d-card">
                    {upcomingEvents.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"20px 0", color:"#94a3b8", fontSize:13, fontWeight:700 }}>
                        <i className="fa-solid fa-calendar-xmark" style={{ fontSize:24, marginBottom:8, display:"block" }} />
                        No upcoming events
                      </div>
                    ) : (
                      upcomingEvents.map((ev: any, i: number) => {
                        const d = new Date(ev.event_date || ev.start_date || ev.date);
                        const evColors: Record<string,string> = { holiday:"#ef4444", exam:"#6366f1", event:"#10b981", meeting:"#f97316" };
                        const ec = evColors[(ev.type||ev.event_type||"event").toLowerCase()] || "#6366f1";
                        return (
                          <div key={ev.id||i} className="d-event">
                            <div className="d-event-date" style={{ background:`${ec}15`, border:`1px solid ${ec}30` }}>
                              <div className="d-event-day" style={{ color:ec }}>{d.getDate()}</div>
                              <div className="d-event-month" style={{ color:ec }}>{d.toLocaleString("en-IN",{month:"short"})}</div>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div className="d-event-name">{ev.title || ev.name || "Event"}</div>
                              <div className="d-event-type" style={{ color:ec }}>
                                {(ev.type || ev.event_type || "Event")}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div className="d-see-all">
                      <Link href="/student/calendar">View calendar <i className="fa-solid fa-arrow-right" style={{ fontSize:10 }} /></Link>
                    </div>
                  </div>
                </div>

              </div>{/* end sidebar */}

            </div>{/* end two-col */}

            <div style={{ height:16 }} />
          </main>
        )}
      </div>
    </>
  );
}
