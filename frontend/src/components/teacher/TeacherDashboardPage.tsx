"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { useAppSelector } from "@/store/hooks";
import Loader, { Spinner } from "@/components/shared/Loader";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text:"Good morning",   icon:"fa-sun"       };
  if (h < 17) return { text:"Good afternoon", icon:"fa-cloud-sun" };
  return       { text:"Good evening",   icon:"fa-moon"      };
}

function getHonorific(gender?: string | null) {
  const value = (gender || "").trim().toLowerCase();
  if (value === "male") return "Sir";
  if (value === "female") return "Ma'am";
  return "Respected Teacher";
}

const SUBJECT_COLORS = ["#6366f1","#0891b2","#16a34a","#dc2626","#9333ea","#0284c7","#d97706","#059669"];
const PRIORITY: Record<string, { dot:string; label:string }> = {
  urgent: { dot:"#ef4444", label:"Urgent" },
  high:   { dot:"#f97316", label:"High"   },
  normal: { dot:"#3b82f6", label:"Notice" },
  low:    { dot:"#94a3b8", label:"Info"   },
};

export default function TeacherDashboardPage() {
  const { formatDateShort } = useDateFormat();
  const relDate = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7)  return `${diff}d ago`;
    return formatDateShort(iso);
  };

  const { user } = useAppSelector(s => s.auth);
  const { data: me, loading } = useApi<any>("/auth/me");
  const { data: noticesRaw }  = useApi<any>("/notices/teacher");
  const { activeYear }        = useAcademicYear();
  const { data: attSummary }  = useApi<any>(
    activeYear?.id ? `/teachers/me/attendance/yearly?academic_year_id=${activeYear.id}` : ""
  );

  const notices: any[]  = (noticesRaw?.data ?? noticesRaw ?? []).slice(0, 5);
  const subjects: any[] = me?.subjects ?? [];
  const sections: any[] = me?.sections ?? [];

  const name       = me?.full_name || user?.full_name || "Teacher";
  const firstName  = name.split(" ")[0];
  const schoolName = me?.school_name || user?.school_name || "";
  const honorific  = getHonorific(me?.gender ?? (user as any)?.gender);
  const greeting   = getGreeting();

  const present   = Number(attSummary?.total_present ?? 0);
  const absent    = Number(attSummary?.total_absent  ?? 0);
  const totalAtt  = present + absent;
  const attPct    = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : null;
  const ringCirc  = 2 * Math.PI * 18;
  const ringArc   = attPct !== null ? (attPct / 100) * ringCirc : 0;

  const quickLinks = [
    { href:"/teacher/attendance/class", icon:"fa-clipboard-check", label:"Mark Attendance", klass:"tqc1" },
    { href:"/teacher/students",          icon:"fa-users",           label:"My Students",     klass:"tqc2" },
    { href:"/teacher/results",           icon:"fa-pen-to-square",   label:"Enter Results",   klass:"tqc3" },
    { href:"/teacher/attendance",        icon:"fa-user-check",      label:"My Attendance",   klass:"tqc4" },
    { href:"/teacher/salary",            icon:"fa-money-bill-wave", label:"My Salary",       klass:"tqc5" },
    { href:"/teacher/calendar",          icon:"fa-calendar-days",   label:"Calendar",        klass:"tqc6" },
    { href:"/teacher/notices",           icon:"fa-bullhorn",        label:"Notices",         klass:"tqc7" },
    { href:"/teacher/profile",           icon:"fa-user",            label:"Profile",         klass:"tqc8" },
  ];

  return (
    <>
      <style>{`
        .td2{background:#f8fafc;min-height:100vh;color:#0f172a}
        .td2-ibtn{width:32px;height:32px;border-radius:9px;border:.5px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#64748b;cursor:pointer;position:relative}
        .td2-ibtn-dot{position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:#f97316}
        .td2-pbtn{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:9px;border:.5px solid #e2e8f0;background:#f8fafc;font-size:12px;color:#475569;text-decoration:none;font-weight:700}
        .td2-wrap{padding:24px 16px 60px;display:flex;flex-direction:column;gap:18px;max-width:1080px;margin:0 auto}
        @media(min-width:768px){.td2-wrap{padding:28px 28px 60px}}
        .td2-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:4px 2px 0}
        .td2-eye{font-size:26px;color:#94a3b8;display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:700}
        .td2-name{font-size:clamp(28px,5vw,42px);font-weight:900;line-height:1;margin:0 0 8px;color:#1e293b}
        .td2-sch{font-size:clamp(24px,4.5vw,40px);color:#FF9B51;font-weight:900;line-height:1.12;margin:0 0 8px}
        .td2-tags{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .td2-tag{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:.5px solid #e2e8f0;background:#fff;font-size:12px;color:#475569;font-weight:700}
        .td2-status{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:.5px solid #86efac;background:#dcfce7;color:#166534;font-size:12px;font-weight:700}
        .td2-sdot{width:7px;height:7px;border-radius:50%;background:#16a34a}
        .td2-av{width:68px;height:68px;border-radius:16px;border:2.5px solid #FF9B51;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#FF9B51;background:#fff7ed;flex-shrink:0;box-shadow:0 4px 14px rgba(255,155,81,.18)}
        .td2-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        @media(max-width:640px){.td2-stats{grid-template-columns:repeat(2,1fr);gap:8px}}
        .td2-stat{background:#fff;border:.5px solid #e2e8f0;border-radius:12px;padding:16px 18px;position:relative;overflow:hidden}
        .td2-stat::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
        .td2-stat.o::before{background:#FF9B51}.td2-stat.g::before{background:#16a34a}.td2-stat.b::before{background:#2563eb}.td2-stat.p::before{background:#6366f1}
        .td2-slbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 6px;display:flex;align-items:center;gap:6px}
        .td2-sval{font-size:36px;font-weight:500;line-height:1;margin:0 0 4px}
        .td2-ssub{font-size:11px;color:#475569;display:flex;align-items:center;gap:6px}
        .td2-sring{position:absolute;right:14px;top:50%;transform:translateY(-50%)}
        .td2-sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        .td2-st{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;display:flex;align-items:center;gap:7px;font-weight:700}
        .td2-sa{font-size:12px;color:#2563eb;text-decoration:none;display:flex;align-items:center;gap:4px;font-weight:700}
        .td2-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        @media(max-width:640px){.td2-quick{grid-template-columns:repeat(2,1fr)}}
        @media(min-width:641px) and (max-width:900px){.td2-quick{grid-template-columns:repeat(3,1fr)}}
        .td2-qc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 10px;text-decoration:none;text-align:center;position:relative;overflow:hidden;transition:border-color .12s,box-shadow .12s}
        .td2-qc:hover{border-color:#FF9B51;box-shadow:0 4px 12px rgba(255,155,81,.12)}
        .td2-qi{width:36px;height:36px;border-radius:10px;border:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;color:#64748b;background:#fff}
        .td2-qc.tqc1 .td2-qi{border-color:#FF9B51;color:#FF9B51}.td2-qc.tqc2 .td2-qi{border-color:#6366f1;color:#6366f1}.td2-qc.tqc3 .td2-qi{border-color:#16a34a;color:#16a34a}.td2-qc.tqc4 .td2-qi{border-color:#0891b2;color:#0891b2}
        .td2-qc.tqc5 .td2-qi{border-color:#f59e0b;color:#f59e0b}.td2-qc.tqc6 .td2-qi{border-color:#2563eb;color:#2563eb}.td2-qc.tqc7 .td2-qi{border-color:#ef4444;color:#ef4444}.td2-qc.tqc8 .td2-qi{border-color:#ec4899;color:#ec4899}
        .td2-ql{font-size:11px;font-weight:700;color:#334155}
        .td2-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:680px){.td2-two{grid-template-columns:1fr}}
        .td2-panel{background:#fff;border:.5px solid #e2e8f0;border-radius:12px;padding:16px}
        .td2-ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        .td2-pt{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;display:flex;align-items:center;gap:7px;font-weight:700}
        .td2-notice{display:flex;gap:10px;padding:8px 0;border-bottom:.5px solid #f1f5f9}
        .td2-notice:last-child{border-bottom:none;padding-bottom:0}
        .td2-nbar{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:14px}
        .td2-subj{display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:.5px solid #f1f5f9}
        .td2-subj:last-child{border-bottom:none}
        .td2-sdot2{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0}
        .td2-secrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid #f1f5f9;text-decoration:none}
        .td2-secrow:last-child{border-bottom:none}
        .td2-secbadge{width:32px;height:32px;border-radius:8px;background:#1f2d36;color:#FF9B51;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0}
        .td2-empty{padding:18px 0;text-align:center;color:#94a3b8}
        .td2-empty i{font-size:22px;display:block;margin-bottom:8px;opacity:.4}
        .td2-empty p{font-size:12px;font-weight:700;margin:0}
      `}</style>

      <div className="td2">
        <div className="td2-wrap">
          {loading ? (
            <Loader fullScreen={false} size="md" text="Loading dashboard…" />
          ) : (<>

            {/* Hero */}
            <div className="td2-hero">
              <div style={{ flex:1, minWidth:0 }}>
                {schoolName && <div className="td2-sch" style={{ fontSize:"clamp(34px,4.5vw,40px)", fontWeight:900, color:"#FF9B51", lineHeight:1.12, margin:0, marginBottom:8 }}>{schoolName}</div>}
                <div className="td2-eye">
                  <img
                    src={greeting.icon === "fa-sun" ? "/icons/GoodMorning.svg" : greeting.icon === "fa-cloud-sun" ? "/icons/Afternoon.svg" : "/icons/GoodEvening.svg"}
                    alt={greeting.text}
                    width={60}
                    height={60}
                    style={{ objectFit:"contain" }}
                  />
                  {greeting.text},
                </div>
                <div className="td2-name">{honorific} {firstName}</div>
                <div className="td2-tags">
                  {me?.employee_id && <span className="td2-tag"><i className="fa-regular fa-id-badge" /> {me.employee_id}</span>}
                  {activeYear?.year_name && <span className="td2-tag"><i className="fa-regular fa-calendar" /> {activeYear.year_name}</span>}
                  <span className="td2-status"><span className="td2-sdot" />{(me?.status ?? "Active").replace("_"," ")}</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="td2-stats">
              <div className="td2-stat o">
                <div className="td2-slbl"><i className="fa-regular fa-calendar-check" /> Attendance</div>
                <div className="td2-sval" style={{ color:"#FF9B51" }}>{attPct !== null ? `${attPct}%` : "—"}</div>
                <div className="td2-ssub"><i className="fa-solid fa-circle" style={{ color:"#22c55e", fontSize:8 }} />{attPct !== null && attPct >= 75 ? "Good standing" : "This year"}</div>
                {attPct !== null && (
                  <svg className="td2-sring" width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="18" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    <circle cx="24" cy="24" r="18" fill="none" stroke="#FF9B51" strokeWidth="3"
                      strokeDasharray={`${ringArc} ${ringCirc - ringArc}`}
                      strokeDashoffset={ringCirc * 0.25} strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div className="td2-stat g">
                <div className="td2-slbl"><i className="fa-solid fa-chalkboard-user" /> Sections</div>
                <div className="td2-sval" style={{ color:"#16a34a" }}>{sections.length || "—"}</div>
                <div className="td2-ssub">Section coordinator</div>
              </div>
              <div className="td2-stat b">
                <div className="td2-slbl"><i className="fa-solid fa-book" /> Subjects</div>
                <div className="td2-sval" style={{ color:"#2563eb" }}>{subjects.length || "—"}</div>
                <div className="td2-ssub">Assigned subjects</div>
              </div>
              <div className="td2-stat p">
                <div className="td2-slbl"><i className="fa-regular fa-bell" /> Notices</div>
                <div className="td2-sval" style={{ color:"#6366f1" }}>{notices.length}</div>
                <div className="td2-ssub">{notices.length > 0 ? "Unread" : "Nothing new"}</div>
              </div>
            </div>

            {/* Quick links */}
            <div>
              <div className="td2-sh">
                <div className="td2-st"><i className="fa-solid fa-bolt" /> Quick Access</div>
              </div>
              <div className="td2-quick">
                {quickLinks.map(q => (
                  <Link key={q.href} href={q.href} className={`td2-qc ${q.klass}`}>
                    <div className="td2-qi"><i className={`fa-solid ${q.icon}`} /></div>
                    <div className="td2-ql">{q.label}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Two column */}
            <div className="td2-two">

              {/* Notices */}
              <div className="td2-panel">
                <div className="td2-ph">
                  <div className="td2-pt"><i className="fa-solid fa-bullhorn" /> Notices</div>
                  <Link href="/teacher/notices" className="td2-sa">See all <i className="fa-solid fa-chevron-right" style={{ fontSize:9 }} /></Link>
                </div>
                {notices.length === 0 ? (
                  <div className="td2-empty"><i className="fa-solid fa-bell-slash" /><p>No notices right now</p></div>
                ) : notices.map((n: any, i: number) => {
                  const p = PRIORITY[n.priority ?? "normal"] ?? PRIORITY.normal;
                  return (
                    <div key={n.id ?? i} className="td2-notice">
                      <div className="td2-nbar" style={{ background:p.dot }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:p.dot }}>{p.label}</span>
                          <span style={{ fontSize:10, color:"#94a3b8" }}>· {relDate(n.created_at ?? new Date().toISOString())}</span>
                        </div>
                        <p style={{ margin:0, fontSize:12, fontWeight:800, color:"#1f2d36", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.title}</p>
                        {n.message && <p style={{ margin:"2px 0 0", fontSize:11, color:"#6a7882", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.message}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sections + Subjects */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                <div className="td2-panel">
                  <div className="td2-ph">
                    <div className="td2-pt"><i className="fa-solid fa-chalkboard" /> My Sections</div>
                    <Link href="/teacher/students" className="td2-sa">Students →</Link>
                  </div>
                  {sections.length === 0 ? (
                    <div className="td2-empty"><i className="fa-solid fa-chalkboard" /><p>No sections assigned</p></div>
                  ) : sections.map((sec: any, i: number) => (
                    <Link key={sec.id ?? i} href="/teacher/students" className="td2-secrow">
                      <div className="td2-secbadge">{(sec.name || "?").charAt(0)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:0, fontSize:12, fontWeight:900, color:"#1f2d36", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {sec.class_name ? `${sec.class_name} — ` : ""}Section {sec.name}
                        </p>
                        <p style={{ margin:"1px 0 0", fontSize:10, fontWeight:600, color:"#94a3b8" }}>Coordinator</p>
                      </div>
                      <span style={{ fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:5, background:"#dcfce7", color:"#15803d", border:"1px solid #bbf7d0", flexShrink:0 }}>Active</span>
                    </Link>
                  ))}
                </div>

                <div className="td2-panel">
                  <div className="td2-ph">
                    <div className="td2-pt"><i className="fa-solid fa-book" /> My Subjects</div>
                    <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", background:"#f1f5f9", padding:"2px 7px", borderRadius:5 }}>{subjects.length}</span>
                  </div>
                  {subjects.length === 0 ? (
                    <div className="td2-empty"><i className="fa-solid fa-book-open" /><p>No subjects assigned</p></div>
                  ) : subjects.slice(0,5).map((sub: any, i: number) => {
                    const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                    return (
                      <div key={sub.id ?? i} className="td2-subj">
                        <div className="td2-sdot2" style={{ background:`${color}18`, color }}>
                          {(sub.name || sub.subject_name || "S").charAt(0)}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <p style={{ margin:0, fontSize:12, fontWeight:800, color:"#1f2d36", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {sub.name || sub.subject_name}
                          </p>
                          {sub.code && <p style={{ margin:0, fontSize:10, fontWeight:700, color:"#94a3b8" }}>{sub.code}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

          </>)}
        </div>
      </div>
    </>
  );
}
