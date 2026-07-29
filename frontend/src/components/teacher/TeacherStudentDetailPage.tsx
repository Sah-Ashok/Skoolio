"use client";

import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, bsToAD, daysInBSMonth, BS_MONTH_NAMES } from "@/lib/bs-ad";
import { useMemo } from "react";

interface Props { studentId: number; }

const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : null;

const initials = (name?: string) =>
  (name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

const gStyle = (g?: string) => ({
  male:   { color:"#1a73e8", bg:"#e8f0fe", border:"#bfdbfe" },
  female: { color:"#c2185b", bg:"#fce4ec", border:"#fbcfe8" },
}[g ?? ""] ?? { color:"#6a7882", bg:"#f1f5f9", border:"#e2e8f0" });

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden", boxShadow:"0 1px 8px rgba(31,45,54,.07)", ...style }}>
      {children}
    </div>
  );
}

function CardHead({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ padding:"13px 20px", borderBottom:"1px solid #f0f4f5", display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:30, height:30, borderRadius:8, background:"#fff7ed", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize:12, color:"#FF9B51" }} />
      </div>
      <span style={{ fontSize:13, fontWeight:900, color:"#1f2d36" }}>{title}</span>
    </div>
  );
}

function Row({ icon, label, value, mono }: { icon: string; label: string; value?: string | null; mono?: boolean }) {
  const empty = !value;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #f7fafb" }}>
      <i className={`fa-solid ${icon}`} style={{ width:14, textAlign:"center", fontSize:11, color: empty ? "#dce5e9" : "#c6d0d7", flexShrink:0 }} />
      <span style={{ fontSize:12, fontWeight:700, color:"#94a3b8", flex:"0 0 130px" }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color: empty ? "#dce5e9" : "#1f2d36", fontFamily: mono ? "monospace" : "inherit", wordBreak:"break-all" }}>
        {empty ? "—" : value}
      </span>
    </div>
  );
}

function DonutRing({ pct, color, size = 72, stroke = 9 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const arc  = (pct / 100) * circ;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {pct > 0 && (
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ - arc}`} strokeDashoffset={0} strokeLinecap="butt"
          style={{ transform:"rotate(-90deg)", transformOrigin:`${size/2}px ${size/2}px` }} />
      )}
    </svg>
  );
}

function AttCard({ label, pct, present, absent, leave, color, working, elapsed }: {
  label: string; pct: number; present: number; absent: number; leave: number; color: string; working?: number; elapsed?: number;
}) {
  return (
    <div style={{ padding:"14px 16px", borderRadius:12, border:"1px solid #e2e8f0", borderLeft:`4px solid ${color}`, display:"flex", flexDirection:"column", gap:12 }}>
      <p style={{ margin:0, fontSize:11, fontWeight:900, color:"#6a7882", textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</p>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ position:"relative", flexShrink:0 }}>
          <DonutRing pct={pct} color={color} size={72} stroke={9} />
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:13, fontWeight:900, color:"#1f2d36" }}>{pct}%</span>
          </div>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
          {[
            { short:"P",  label:"Present", val:present, color:"#12805c", bg:"#e2f6ee" },
            { short:"A",  label:"Absent",  val:absent,  color:"#b42318", bg:"#fde7e7" },
            { short:"Lv", label:"Leave",   val:leave,   color:"#7c3aed", bg:"#f3eeff" },
          ].map(r => (
            <div key={r.short} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:9, fontWeight:900, color:r.color, background:r.bg, padding:"1px 5px", borderRadius:4, minWidth:16, textAlign:"center" }}>{r.short}</span>
              <span style={{ fontSize:11, fontWeight:600, color:"#94a3b8", flex:1 }}>{r.label}</span>
              <strong style={{ fontSize:13, fontWeight:900, color:r.val === 0 ? "#c6d0d7" : r.color }}>{r.val}</strong>
            </div>
          ))}
          {working !== undefined && working > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:4, paddingTop:6, borderTop:"1px solid #f0f4f5", marginTop:2 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:9, fontWeight:900, color:"#6a7882", background:"#f1f5f9", padding:"1px 5px", borderRadius:4, minWidth:16, textAlign:"center" }}>W</span>
                <span style={{ fontSize:11, fontWeight:600, color:"#94a3b8", flex:1 }}>{elapsed !== undefined ? "Total Days" : "Working"}</span>
                <strong style={{ fontSize:13, fontWeight:900, color:"#1f2d36" }}>{working}</strong>
              </div>
              {elapsed !== undefined && elapsed > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:9, fontWeight:900, color:"#1a73e8", background:"#e8f0fe", padding:"1px 5px", borderRadius:4, minWidth:16, textAlign:"center" }}>E</span>
                  <span style={{ fontSize:11, fontWeight:600, color:"#94a3b8", flex:1 }}>Elapsed</span>
                  <strong style={{ fontSize:13, fontWeight:900, color:"#1a73e8" }}>{elapsed}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function TeacherStudentDetailPage({ studentId }: Props) {
  const router                      = useRouter();
  const { activeYear }              = useAcademicYear();
  const { formatDate, formatMonth } = useDateFormat();

  const { data: student,     loading: sLoad } = useApi<any>(
    studentId ? `/students/${studentId}` : "", [studentId]
  );
  const { data: enrollments, loading: eLoad } = useApi<any[]>(
    studentId && activeYear?.id
      ? `/students/enrollments?student_id=${studentId}&academic_year_id=${activeYear.id}`
      : "",
    [studentId, activeYear?.id]
  );
  const { data: yearlySummary } = useApi<any>(
    studentId && activeYear?.id
      ? `/attendance/student/${studentId}/summary?academic_year_id=${activeYear.id}`
      : "",
    [studentId, activeYear?.id]
  );

  const now    = new Date();

  // ── Fetch full-year working days from calendar (accurate total from school calendar)
  // The summary API only counts elapsed working days (up to today),
  // but the user wants total working days for the whole academic year.
  const { data: yearWorkingData } = useApi<any>(
    studentId && activeYear?.id && activeYear?.start_date && activeYear?.end_date
      ? `/calendar/working-days?academic_year_id=${activeYear.id}&start_date=${String(activeYear.start_date).slice(0,10)}&end_date=${String(activeYear.end_date).slice(0,10)}`
      : "",
    [activeYear?.id]
  );
  // Elapsed working days (start to today) come from summary API's total_working_days

  // ── BS/AD-aware month calculation ────────────────────────────────
  // Follow the same approach as OwnAttendancePage:
  // 1. Get current month in BS (or AD)
  // 2. Convert BS month start day → AD for API params
  // 3. A BS month may span two AD months → need two API calls
  const { isBS: isBSHook } = useDateFormat();

  const todayBS = useMemo(() => adToBS(now), []);

  // Current and previous month in display coordinates (BS or AD)
  const currDisp = useMemo(() => {
    if (isBSHook) {
      return { year: todayBS.year, month: todayBS.month };
    }
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [isBSHook, todayBS]);

  const prevDisp = useMemo(() => {
    if (isBSHook) {
      const m = todayBS.month - 1;
      return m <= 0 ? { year: todayBS.year - 1, month: 12 } : { year: todayBS.year, month: m };
    }
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [isBSHook, todayBS]);

  // Convert display month to AD API params (BS month start → AD year/month)
  const dispToADParams = (disp: { year: number; month: number }) => {
    if (isBSHook) {
      const adStart = bsToAD({ year: disp.year, month: disp.month, day: 1 });
      const lastDay = daysInBSMonth(disp.year, disp.month);
      const adEnd   = bsToAD({ year: disp.year, month: disp.month, day: lastDay });
      const p1 = { year: adStart.getFullYear(), month: adStart.getMonth() + 1 };
      // Check if month end falls in a different AD month
      const p2 = (adEnd.getFullYear() !== p1.year || adEnd.getMonth() + 1 !== p1.month)
        ? { year: adEnd.getFullYear(), month: adEnd.getMonth() + 1 }
        : null;
      return { p1, p2 };
    }
    return { p1: disp, p2: null };
  };

  const currParams = useMemo(() => dispToADParams(currDisp), [currDisp, isBSHook]);
  const prevParams = useMemo(() => dispToADParams(prevDisp), [prevDisp, isBSHook]);

  // Month display labels
  const cLabel = isBSHook
    ? `${BS_MONTH_NAMES[currDisp.month - 1]} ${currDisp.year}`
    : `${['January','February','March','April','May','June','July','August','September','October','November','December'][currDisp.month - 1]} ${currDisp.year}`;
  const pLabel = isBSHook
    ? `${BS_MONTH_NAMES[prevDisp.month - 1]} ${prevDisp.year}`
    : `${['January','February','March','April','May','June','July','August','September','October','November','December'][prevDisp.month - 1]} ${prevDisp.year}`;

  const mkUrl = (p: { year: number; month: number } | null) =>
    p && studentId && activeYear?.id
      ? `/attendance/student/${studentId}/monthly?year=${p.year}&month=${p.month}&academic_year_id=${activeYear.id}`
      : "";

  const { data: currRaw1 } = useApi<any>(mkUrl(currParams.p1), [mkUrl(currParams.p1)]);
  const { data: currRaw2 } = useApi<any>(mkUrl(currParams.p2), [mkUrl(currParams.p2)]);
  const { data: prevRaw1 } = useApi<any>(mkUrl(prevParams.p1), [mkUrl(prevParams.p1)]);
  const { data: prevRaw2 } = useApi<any>(mkUrl(prevParams.p2), [mkUrl(prevParams.p2)]);


  const loading    = sLoad || eLoad;
  const enrollment = enrollments?.[0] ?? null;
  const gs         = gStyle(student?.gender);

  // Unwrap and merge API responses (BS months may span two AD months)
  const normalise = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.records)) return raw.records;
    return [];
  };

  const currRecs = useMemo(() => [...normalise(currRaw1), ...normalise(currRaw2)], [currRaw1, currRaw2]);
  const prevRecs = useMemo(() => [...normalise(prevRaw1), ...normalise(prevRaw2)], [prevRaw1, prevRaw2]);

  const yPresent     = Number(yearlySummary?.total_present        ?? 0);
  const yAbsent      = Number(yearlySummary?.total_absent         ?? 0);
  const yLeave       = Number(yearlySummary?.total_leave          ?? 0);
  const yElapsed     = Number(yearlySummary?.total_working_days   ?? 0); // working days up to today
  const yTotalWD     = Number(yearWorkingData?.working_days       ?? yElapsed); // full year working days
  // Use the API's computed attendance_percentage (includes late/present/absent correctly)
  const apiPct       = Number(yearlySummary?.attendance_percentage ?? 0);
  const yMarked      = yPresent + yAbsent + yLeave;
  const yPct         = apiPct > 0 ? Math.round(apiPct)
                     : yMarked > 0 ? Math.round((yPresent / yMarked) * 100) : 0;
  const yColor   = yPct >= 85 ? "#12805c" : yPct >= 70 ? "#c46a14" : "#b42318";

  const countS = (arr: any[], s: string) => arr.filter((r: any) => r.status === s).length;
  const mStat  = (recs: any[]) => {
    const p = countS(recs, "present"), a = countS(recs, "absent"), l = countS(recs, "leave");
    const d = p + a + l;
    return { p, a, l, d, pct: d > 0 ? Math.max(0, Math.round(((d - a) / d) * 100)) : 0 };
  };

  const curr   = mStat(currRecs);
  const prev   = mStat(prevRecs);
  const cColor = curr.pct >= 85 ? "#12805c" : curr.pct >= 70 ? "#c46a14" : "#b42318";
  const pColor = prev.pct >= 85 ? "#12805c" : prev.pct >= 70 ? "#c46a14" : "#b42318";

  return (
    <>
      <style>{`
        .tsd { min-height:100vh; background:#eef2f3; }
        .tsd-wrap { padding:20px; max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        .tsd-cols { display:grid; grid-template-columns:1fr; gap:16px; }
        @media(min-width:760px){ .tsd-cols { grid-template-columns:300px 1fr; align-items:start; } }
        .att-2col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:480px){ .att-2col { grid-template-columns:1fr; } }
      `}</style>

      <div className="tsd">
        <Topbar title="Student Profile" subtitle="Detailed student information" />
        <div className="tsd-wrap">

          {/* Back */}
          <button onClick={() => router.back()}
            style={{ alignSelf:"flex-start", display:"inline-flex", alignItems:"center", gap:7, padding:"8px 16px", borderRadius:9, border:"1px solid #dce5e9", background:"#fff", fontSize:13, fontWeight:800, color:"#475569", cursor:"pointer", boxShadow:"0 1px 4px rgba(31,45,54,.06)" }}>
            <i className="fa-solid fa-arrow-left" style={{ fontSize:11 }} /> Back to My Students
          </button>

          {loading ? (
            <div style={{ padding:"6rem", textAlign:"center" }}><Spinner size={32} color="#FF9B51" /></div>
          ) : !student ? (
            <Card style={{ padding:"4rem", textAlign:"center" }}>
              <i className="fa-solid fa-user-slash" style={{ fontSize:40, color:"#d4dde2", display:"block", marginBottom:14 }} />
              <p style={{ fontSize:15, fontWeight:800, color:"#1f2d36", margin:0 }}>Student not found</p>
            </Card>
          ) : (
            <div className="tsd-cols">

              {/* ══ LEFT ══ */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                {/* Hero */}
                <Card>
                  <div style={{ display:"flex" }}>
                    <div style={{ width:90, background:"#25343F", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 0", flexShrink:0 }}>
                      <div style={{ width:54, height:54, borderRadius:14, background:gs.bg, border:`2px solid ${gs.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:gs.color }}>
                        {initials(student.full_name)}
                      </div>
                    </div>
                    <div style={{ flex:1, padding:"18px 16px" }}>
                      <h1 style={{ margin:"0 0 4px", fontSize:17, fontWeight:900, color:"#1f2d36", lineHeight:1.2 }}>{student.full_name}</h1>
                      <span style={{ display:"inline-block", padding:"2px 9px", borderRadius:99, fontSize:11, fontWeight:800, background:gs.bg, color:gs.color, border:`1px solid ${gs.border}` }}>
                        {cap(student.gender) || "—"}
                      </span>
                      {enrollment && (
                        <p style={{ margin:"8px 0 0", fontSize:12, fontWeight:700, color:"#6a7882" }}>
                          {enrollment.class_name} · Sec {enrollment.section_name}
                          {enrollment.roll_number && <> · <strong style={{ color:"#1f2d36" }}>Roll {enrollment.roll_number}</strong></>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Chips */}
                  {(student.blood_group || student.date_of_birth || student.nationality) && (
                    <div style={{ padding:"10px 16px 14px", borderTop:"1px solid #f0f4f5", display:"flex", flexWrap:"wrap", gap:6 }}>
                      {student.blood_group && (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:8, background:"#fde7e7", color:"#b42318", fontSize:11, fontWeight:800, border:"1px solid #fca5a5" }}>
                          <i className="fa-solid fa-droplet" style={{ fontSize:9 }} /> {student.blood_group}
                        </span>
                      )}
                      {student.date_of_birth && (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:8, background:"#fff7ed", color:"#c46a14", fontSize:11, fontWeight:800, border:"1px solid #fde68a" }}>
                          <i className="fa-solid fa-cake-candles" style={{ fontSize:9 }} /> {formatDate(student.date_of_birth)}
                        </span>
                      )}
                      {student.nationality && (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:8, background:"#e8f0fe", color:"#1a73e8", fontSize:11, fontWeight:800, border:"1px solid #bfdbfe" }}>
                          <i className="fa-solid fa-flag" style={{ fontSize:9 }} /> {student.nationality}
                        </span>
                      )}
                    </div>
                  )}
                </Card>

                {/* Guardian */}
                <Card>
                  <CardHead icon="fa-shield-halved" title="Guardian" />
                  <div style={{ padding:"4px 20px 12px" }}>
                    <Row icon="fa-person-shelter" label="Name"     value={student.guardian_name} />
                    <Row icon="fa-people-roof"    label="Relation" value={cap(student.guardian_relation)} />
                    <Row icon="fa-phone-flip"     label="Phone"    value={student.guardian_phone} />
                    <Row icon="fa-envelope"       label="Email"    value={student.guardian_email} />
                  </div>
                </Card>

                {/* Contact */}
                <Card>
                  <CardHead icon="fa-address-book" title="Contact" />
                  <div style={{ padding:"4px 20px 12px" }}>
                    <Row icon="fa-phone"      label="Student Phone" value={student.phone} />
                    <Row icon="fa-envelope"   label="Email"         value={student.email} />
                    <Row icon="fa-city"       label="City"          value={student.city} />
                    <Row icon="fa-map"        label="State"         value={student.state} />
                    <Row icon="fa-earth-asia" label="Country"       value={student.country} />
                  </div>
                </Card>
              </div>

              {/* ══ RIGHT ══ */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                {/* Attendance */}
                <Card>
                  <CardHead icon="fa-chart-pie" title="Attendance Overview" />
                  <div style={{ padding:"14px 18px", display:"flex", flexDirection:"column", gap:12 }}>
                    <AttCard
                      label={`Full Year · ${activeYear?.year_name ?? ""}`}
                      pct={yPct} present={yPresent} absent={yAbsent} leave={yLeave}
                      color={yColor} working={yTotalWD > 0 ? yTotalWD : undefined}
                      elapsed={yElapsed > 0 ? yElapsed : undefined}
                    />
                    <div className="att-2col">
                      <AttCard label={cLabel} pct={curr.pct} present={curr.p} absent={curr.a} leave={curr.l} color={cColor} />
                      <AttCard label={pLabel} pct={prev.pct} present={prev.p} absent={prev.a} leave={prev.l} color={pColor} />
                    </div>
                  </div>
                </Card>

                {/* Academic */}
                <Card>
                  <CardHead icon="fa-graduation-cap" title="Academic Info" />
                  <div style={{ padding:"4px 20px 12px" }}>
                    <Row icon="fa-id-badge"      label="Admission No."    value={student.admission_number} mono />
                    <Row icon="fa-calendar-plus" label="Admission Date"   value={formatDate(student.admission_date)} />
                    <Row icon="fa-school"        label="Class"            value={enrollment?.class_name} />
                    <Row icon="fa-table-cells"   label="Section"          value={enrollment?.section_name} />
                    <Row icon="fa-list-ol"       label="Roll Number"      value={enrollment?.roll_number?.toString() || "Not assigned"} />
                    <Row icon="fa-file-lines"    label="Registration No." value={enrollment?.registration_number} mono />
                    <Row icon="fa-hashtag"       label="Symbol Number"    value={enrollment?.symbol_number} mono />
                  </div>
                </Card>

                {/* Personal */}
                <Card>
                  <CardHead icon="fa-user" title="Personal Details" />
                  <div style={{ padding:"4px 20px 12px" }}>
                    <Row icon="fa-cake-candles"  label="Date of Birth" value={formatDate(student.date_of_birth)} />
                    <Row icon="fa-venus-mars"    label="Gender"        value={cap(student.gender)} />
                    <Row icon="fa-droplet"       label="Blood Group"   value={student.blood_group} />
                    <Row icon="fa-pray"          label="Religion"      value={student.religion} />
                    <Row icon="fa-people-group"  label="Ethnicity"     value={student.ethnicity} />
                    <Row icon="fa-flag"          label="Nationality"   value={student.nationality} />
                  </div>
                </Card>

              </div>
            </div>
          )}

          {/* Footer note */}
          <div style={{ padding:"10px 16px", borderRadius:10, background:"#fff7ed", border:"1px solid #fed7aa", borderLeft:"4px solid #FF9B51", display:"flex", gap:9, alignItems:"flex-start" }}>
            <i className="fa-solid fa-circle-info" style={{ color:"#c2410c", fontSize:13, flexShrink:0, marginTop:1 }} />
            <span style={{ fontSize:12, fontWeight:700, color:"#92400e" }}>
              Only <strong>Roll Number</strong> and <strong>Remarks</strong> can be edited from the Students list. All other details are managed by the school admin.
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
