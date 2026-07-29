"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { useAppSelector } from "@/store/hooks";
import { Spinner } from "@/components/shared/Loader";

/* ── helpers ── */
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const relDate = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short" });
};

const hour     = new Date().getHours();
const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
const dateStr  = new Date().toLocaleDateString("en-US", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

const PRIORITY: Record<string, { dot: string; label: string }> = {
  urgent: { dot:"#ef4444", label:"Urgent"  },
  high:   { dot:"#f97316", label:"High"    },
  normal: { dot:"#3b82f6", label:"Notice"  },
  low:    { dot:"#94a3b8", label:"Info"    },
};

const SUBJECT_COLORS = ["#6366f1","#0891b2","#16a34a","#dc2626","#9333ea","#0284c7","#d97706","#059669"];

export default function TeacherDashboardPage() {
  const { user }     = useAppSelector((s) => s.auth);
  const { data: me, loading } = useApi<any>("/auth/me");
  const { data: noticesRaw }  = useApi<any>("/notices/teacher");
  const { data: attSummary }  = useApi<any>("/teachers/me/attendance/yearly");

  const notices: any[]  = (noticesRaw?.data ?? noticesRaw ?? []).slice(0, 6);
  const subjects: any[] = me?.subjects ?? [];
  const sections: any[] = me?.sections ?? [];
  const name = me?.full_name || user?.full_name || "Teacher";

  const present  = Number(attSummary?.total_present ?? 0);
  const absent   = Number(attSummary?.total_absent  ?? 0);
  const totalAtt = present + absent;
  const attPct   = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : null;

  const circ = 2 * Math.PI * 20;
  const arc  = attPct !== null ? (attPct / 100) * circ : 0;

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;}

        .td{min-height:100vh;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
        .td-wrap{max-width:1080px;margin:0 auto;padding:24px 20px 60px;}
        @media(min-width:700px){.td-wrap{padding:28px 28px 60px;}}

        /* greeting row */
        .td-greeting{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:28px;}
        .td-name{font-size:clamp(22px,4vw,30px);font-weight:900;color:#1f2d36;letter-spacing:-0.5px;line-height:1.1;margin:0 0 4px;}
        .td-sub{font-size:12px;font-weight:600;color:#6a7882;margin:0;}
        .td-status{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;border:1px solid #bbf7d0;background:#f0fdf4;font-size:10px;font-weight:800;color:#15803d;margin-left:10px;}
        .td-status::before{content:'';width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;}

        /* stat row */
        .td-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
        @media(max-width:640px){.td-stats{grid-template-columns:repeat(2,1fr);gap:8px;}}
        .td-stat{background:#fff;border:1px solid #e8eef0;border-radius:12px;padding:16px;}
        .td-stat-val{font-size:20px;font-weight:900;color:#1f2d36;margin:0 0 2px;}
        .td-stat-lbl{font-size:10px;font-weight:700;color:#6a7882;text-transform:uppercase;letter-spacing:.5px;margin:0;}

        /* main layout */
        .td-layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start;}
        @media(max-width:860px){.td-layout{grid-template-columns:1fr;}}

        /* left col */
        .td-left{display:flex;flex-direction:column;gap:16px;}

        /* cards */
        .td-card{background:#fff;border:1px solid #e8eef0;border-radius:14px;overflow:hidden;}
        .td-card-head{padding:14px 18px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;}
        .td-card-title{font-size:13px;font-weight:900;color:#1f2d36;margin:0;display:flex;align-items:center;gap:7px;}
        .td-card-link{font-size:11px;font-weight:700;color:#FF9B51;text-decoration:none;}
        .td-card-body{padding:14px 18px;}

        /* quick actions grid */
        .td-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
        @media(max-width:480px){.td-actions{grid-template-columns:repeat(2,1fr);}}
        .td-action{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:14px 8px;border-radius:10px;border:1px solid #e8eef0;text-decoration:none;background:#fff;transition:border-color .12s,background .12s;text-align:center;}
        .td-action:hover{border-color:#FF9B51;background:#fff7ed;}
        .td-action.primary{background:#FF9B51;border-color:#FF9B51;}
        .td-action.primary:hover{background:#f08b42;border-color:#f08b42;}
        .td-action-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;}
        .td-action-label{font-size:11px;font-weight:800;color:#1f2d36;line-height:1.2;}
        .td-action.primary .td-action-label{color:#fff;}

        /* subjects */
        .td-subjects{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
        .td-subject{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;border:1px solid #e8eef0;}
        .td-subject-dot{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;}
        .td-subject-name{font-size:12px;font-weight:800;color:#1f2d36;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .td-subject-code{font-size:10px;font-weight:700;color:#94a3b8;margin-top:1px;}

        /* sections */
        .td-section{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid #e8eef0;margin-bottom:8px;text-decoration:none;}
        .td-section:last-child{margin-bottom:0;}
        .td-section:hover{border-color:#FF9B51;background:#fff7ed;}
        .td-section-badge{width:36px;height:36px;border-radius:9px;background:#1f2d36;color:#FF9B51;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;flex-shrink:0;}

        /* right sidebar */
        .td-right{display:flex;flex-direction:column;gap:14px;}

        /* profile card */
        .td-profile{background:#fff;border:1px solid #e8eef0;border-radius:14px;overflow:hidden;}
        .td-profile-top{background:#1f2d36;padding:20px 18px 52px;position:relative;}
        .td-avatar-wrap{position:absolute;bottom:-28px;left:18px;}
        .td-avatar{width:56px;height:56px;border-radius:14px;background:#FF9B51;color:#fff;font-size:20px;font-weight:900;display:flex;align-items:center;justify-content:center;border:3px solid #fff;}
        .td-profile-info{padding:36px 18px 14px;}
        .td-profile-name{font-size:15px;font-weight:900;color:#1f2d36;margin:0 0 2px;}
        .td-profile-meta{font-size:11px;font-weight:700;color:#6a7882;margin:0;}
        .td-profile-rows{border-top:1px solid #f1f5f9;padding:10px 18px;}
        .td-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f8fafc;}
        .td-row:last-child{border-bottom:none;}
        .td-row-label{font-size:11px;font-weight:700;color:#94a3b8;display:flex;align-items:center;gap:6px;}
        .td-row-val{font-size:12px;font-weight:800;color:#1f2d36;text-align:right;text-transform:capitalize;}

        /* attendance ring */
        .td-att{background:#fff;border:1px solid #e8eef0;border-radius:14px;padding:16px 18px;}
        .td-att-head{font-size:12px;font-weight:900;color:#1f2d36;margin:0 0 12px;}
        .td-att-row{display:flex;align-items:center;gap:14px;}
        .td-att-stats{display:flex;flex-direction:column;gap:6px;flex:1;}
        .td-att-line{display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .td-att-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0;}

        /* notices */
        .td-notice{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f8fafc;}
        .td-notice:last-child{border-bottom:none;}
        .td-notice-dot{width:6px;flex-shrink:0;border-radius:3px;margin-top:4px;align-self:stretch;}

        /* empty */
        .td-empty{padding:24px;text-align:center;color:#94a3b8;}
        .td-empty i{font-size:24px;display:block;margin-bottom:8px;opacity:.5;}
        .td-empty p{font-size:12px;font-weight:700;margin:0;}

        @media(max-width:480px){
          .td-card-body{padding:12px 14px;}
          .td-profile-info{padding:34px 14px 12px;}
          .td-profile-rows{padding:8px 14px;}
        }
      `}</style>

      <div className="td">
        <Topbar title="Dashboard" subtitle={`${greeting} · ${dateStr}`} />

        <div className="td-wrap">
          {loading ? (
            <div style={{ padding:"5rem 0", textAlign:"center" }}>
              <Spinner size={28} color="#FF9B51" />
              <p style={{ marginTop:12, fontSize:12, fontWeight:700, color:"#94a3b8" }}>Loading dashboard…</p>
            </div>
          ) : (
            <>
              {/* ── Greeting ── */}
              <div className="td-greeting">
                <div>
                  <h1 className="td-name">
                    {greeting}, {name.split(" ")[0]}
                    <span className="td-status">{me?.status ?? "Active"}</span>
                  </h1>
                  <p className="td-sub">{me?.school_name ?? "Skoolio School"} · {dateStr}</p>
                </div>
              </div>

              {/* ── Stat chips ── */}
              <div className="td-stats">
                {[
                  { val: sections.length || "—", lbl: "My Sections",   accent: "#FF9B51" },
                  { val: subjects.length || "—", lbl: "My Subjects",   accent: "#6366f1" },
                  { val: me?.experience_years ? `${me.experience_years} yrs` : "—", lbl: "Experience", accent: "#16a34a" },
                  { val: attPct !== null ? `${attPct}%` : "—", lbl: "My Attendance", accent: "#0891b2" },
                ].map(c => (
                  <div key={c.lbl} className="td-stat" style={{ borderLeft:`3px solid ${c.accent}` }}>
                    <p className="td-stat-val" style={{ color: c.accent }}>{c.val}</p>
                    <p className="td-stat-lbl">{c.lbl}</p>
                  </div>
                ))}
              </div>

              {/* ── Main layout ── */}
              <div className="td-layout">

                {/* LEFT */}
                <div className="td-left">

                  {/* Quick Actions */}
                  <div className="td-card">
                    <div className="td-card-head">
                      <p className="td-card-title"><i className="fa-solid fa-bolt" style={{ color:"#FF9B51" }} /> Quick Actions</p>
                    </div>
                    <div className="td-card-body">
                      <div className="td-actions">
                        {[
                          { href:"/teacher/attendance/class", icon:"fa-clipboard-check", label:"Mark Attendance",  primary:true  },
                          { href:"/teacher/students",          icon:"fa-users",           label:"My Students",     primary:false },
                          { href:"/teacher/results",           icon:"fa-pen-to-square",   label:"Enter Results",   primary:false },
                          { href:"/teacher/attendance",        icon:"fa-user-check",      label:"My Attendance",   primary:false },
                          { href:"/teacher/salary",            icon:"fa-money-bill-wave", label:"My Salary",       primary:false },
                          { href:"/teacher/calendar",          icon:"fa-calendar",        label:"Calendar",        primary:false },
                        ].map(a => (
                          <Link key={a.href} href={a.href} className={`td-action${a.primary ? " primary" : ""}`}>
                            <div className="td-action-icon" style={{
                              background: a.primary ? "rgba(255,255,255,.2)" : "#fff7ed",
                              color: a.primary ? "#fff" : "#FF9B51",
                            }}>
                              <i className={`fa-solid ${a.icon}`} />
                            </div>
                            <span className="td-action-label">{a.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* My Sections */}
                  <div className="td-card">
                    <div className="td-card-head">
                      <p className="td-card-title"><i className="fa-solid fa-chalkboard-user" style={{ color:"#1f2d36" }} /> My Sections</p>
                      <Link href="/teacher/students" className="td-card-link">View students →</Link>
                    </div>
                    <div className="td-card-body">
                      {sections.length === 0 ? (
                        <div className="td-empty"><i className="fa-solid fa-chalkboard" /><p>No sections assigned yet</p></div>
                      ) : sections.map((sec: any, i: number) => (
                        <Link key={sec.id ?? i} href="/teacher/students" className="td-section">
                          <div className="td-section-badge">{(sec.name || "?").charAt(0)}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:0, fontSize:13, fontWeight:900, color:"#1f2d36" }}>
                              {sec.class_name ? `${sec.class_name} —` : ""} Section {sec.name}
                            </p>
                            <p style={{ margin:"2px 0 0", fontSize:11, fontWeight:600, color:"#6a7882" }}>
                              {sec.room_no ? `Room ${sec.room_no} · ` : ""}Section Coordinator
                            </p>
                          </div>
                          <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:5, background:sec.status==="inactive"?"#f1f5f9":"#f0fdf4", color:sec.status==="inactive"?"#6a7882":"#15803d", flexShrink:0, border:`1px solid ${sec.status==="inactive"?"#e2e8f0":"#bbf7d0"}` }}>
                            {sec.status ?? "Active"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* My Subjects */}
                  <div className="td-card">
                    <div className="td-card-head">
                      <p className="td-card-title"><i className="fa-solid fa-book" style={{ color:"#6366f1" }} /> My Subjects</p>
                      <span style={{ fontSize:10, fontWeight:700, color:"#6a7882", background:"#f1f5f9", padding:"2px 8px", borderRadius:5 }}>{subjects.length} assigned</span>
                    </div>
                    <div className="td-card-body">
                      {subjects.length === 0 ? (
                        <div className="td-empty"><i className="fa-solid fa-book-open" /><p>No subjects assigned</p></div>
                      ) : (
                        <div className="td-subjects">
                          {subjects.map((sub: any, i: number) => {
                            const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                            return (
                              <div key={sub.id ?? i} className="td-subject">
                                <div className="td-subject-dot" style={{ background:`${color}15`, color }}>
                                  {(sub.name || sub.subject_name || "S").charAt(0)}
                                </div>
                                <div style={{ minWidth:0 }}>
                                  <p className="td-subject-name">{sub.name || sub.subject_name}</p>
                                  {sub.code && <p className="td-subject-code">{sub.code}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notice Board */}
                  <div className="td-card">
                    <div className="td-card-head">
                      <p className="td-card-title"><i className="fa-solid fa-bullhorn" style={{ color:"#3b82f6" }} /> Notice Board</p>
                      <Link href="/teacher/notices" className="td-card-link">See all →</Link>
                    </div>
                    <div className="td-card-body" style={{ padding:"4px 18px" }}>
                      {notices.length === 0 ? (
                        <div className="td-empty" style={{ padding:"18px 0" }}>
                          <i className="fa-solid fa-bell-slash" /><p>No notices right now</p>
                        </div>
                      ) : notices.map((n: any) => {
                        const p = PRIORITY[n.priority ?? "normal"] ?? PRIORITY.normal;
                        return (
                          <div key={n.id} className="td-notice">
                            <div className="td-notice-dot" style={{ background: p.dot }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                                <span style={{ fontSize:10, fontWeight:700, color:p.dot }}>{p.label}</span>
                                <span style={{ fontSize:10, color:"#94a3b8" }}>·</span>
                                <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>
                                  {relDate(n.created_at ?? n.date ?? new Date().toISOString())}
                                </span>
                              </div>
                              <p style={{ margin:0, fontSize:13, fontWeight:800, color:"#1f2d36", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.title}</p>
                              {n.message && (
                                <p style={{ margin:"2px 0 0", fontSize:11, color:"#6a7882", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.message}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* RIGHT sidebar */}
                <div className="td-right">

                  {/* Profile card */}
                  <div className="td-profile">
                    <div className="td-profile-top">
                      <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".6px" }}>{me?.school_name ?? "Teacher Portal"}</p>
                      <p style={{ margin:0, fontSize:12, fontWeight:600, color:"#bfc9d1" }}>{me?.role === "faculty" ? "Faculty Member" : "Teacher"}</p>
                      <div className="td-avatar-wrap">
                        <div className="td-avatar">
                          {name.split(" ").map((n: string) => n[0]).slice(0,2).join("").toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="td-profile-info">
                      <p className="td-profile-name">{name}</p>
                      <p className="td-profile-meta">{me?.qualification ?? "Faculty"} · Joined {fmt(me?.join_date)}</p>
                    </div>
                    <div className="td-profile-rows">
                      {[
                        { icon:"fa-venus-mars",   label:"Gender",   val:me?.gender          },
                        { icon:"fa-phone",        label:"Phone",    val:me?.phone            },
                        { icon:"fa-envelope",     label:"Email",    val:me?.email            },
                        { icon:"fa-cake-candles", label:"Birthday", val:fmt(me?.date_of_birth) },
                      ].map(r => (
                        <div key={r.label} className="td-row">
                          <span className="td-row-label">
                            <i className={`fa-solid ${r.icon}`} style={{ fontSize:10, color:"#c6d0d7", width:12 }} />
                            {r.label}
                          </span>
                          <span className="td-row-val">{r.val || "—"}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding:"10px 18px 14px" }}>
                      <Link href="/teacher/profile" style={{ display:"block", width:"100%", padding:"9px 0", borderRadius:9, border:"1.5px solid #FF9B51", background:"transparent", color:"#FF9B51", fontSize:12, fontWeight:900, textAlign:"center", textDecoration:"none", transition:"background .12s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="#fff7ed"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; }}>
                        <i className="fa-solid fa-pen" style={{ marginRight:6 }} /> Edit Profile
                      </Link>
                    </div>
                  </div>

                  {/* Attendance card */}
                  {attPct !== null && (
                    <div className="td-att">
                      <p className="td-att-head">My Attendance · This Year</p>
                      <div className="td-att-row">
                        {/* SVG ring */}
                        <svg viewBox="0 0 52 52" width={56} height={56} style={{ flexShrink:0 }}>
                          <circle cx="26" cy="26" r="20" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                          <circle cx="26" cy="26" r="20" fill="none"
                            stroke={attPct >= 75 ? "#22c55e" : attPct >= 50 ? "#f97316" : "#ef4444"}
                            strokeWidth="6"
                            strokeDasharray={`${arc} ${circ}`}
                            strokeDashoffset={circ / 4}
                            strokeLinecap="round"
                          />
                          <text x="26" y="30" textAnchor="middle" fontSize="9" fontWeight="900" fill="#1f2d36">{attPct}%</text>
                        </svg>
                        <div className="td-att-stats">
                          {[
                            { label:"Present", val:present, color:"#22c55e" },
                            { label:"Absent",  val:absent,  color:"#ef4444" },
                          ].map(r => (
                            <div key={r.label} className="td-att-line">
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <span className="td-att-dot" style={{ background:r.color }} />
                                <span style={{ fontSize:11, fontWeight:700, color:"#6a7882" }}>{r.label}</span>
                              </div>
                              <span style={{ fontSize:13, fontWeight:900, color:"#1f2d36" }}>{r.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Link href="/teacher/attendance" style={{ display:"block", marginTop:12, fontSize:11, fontWeight:700, color:"#FF9B51", textDecoration:"none", textAlign:"right" }}>
                        View full record →
                      </Link>
                    </div>
                  )}

                  {/* School info */}
                  <div className="td-card">
                    <div className="td-card-head">
                      <p className="td-card-title"><i className="fa-solid fa-building-columns" style={{ color:"#6a7882" }} /> School</p>
                    </div>
                    <div className="td-card-body" style={{ padding:"10px 18px" }}>
                      {[
                        { icon:"fa-building",      label:"Name",    val:me?.school_name },
                        { icon:"fa-location-dot",  label:"City",    val:me?.city        },
                        { icon:"fa-phone",         label:"Phone",   val:me?.school_phone ?? me?.phone },
                        { icon:"fa-envelope",      label:"Email",   val:me?.school_email ?? me?.email },
                      ].map(r => (
                        <div key={r.label} className="td-row">
                          <span className="td-row-label">
                            <i className={`fa-solid ${r.icon}`} style={{ fontSize:10, color:"#c6d0d7", width:12 }} />
                            {r.label}
                          </span>
                          <span style={{ fontSize:12, fontWeight:700, color:"#1f2d36", textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"55%" }}>{r.val || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
