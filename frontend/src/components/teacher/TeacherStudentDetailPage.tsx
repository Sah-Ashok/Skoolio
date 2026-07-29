"use client";

import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAcademicYear } from "@/hooks/useAcademicYear";

interface Props { studentId: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" }) : null;

const gInfo = (g?: string) => ({
  male:   { color:"#1a73e8", bg:"#e8f0fe", border:"#bfdbfe", label:"Male"   },
  female: { color:"#c2185b", bg:"#fce4ec", border:"#fbcfe8", label:"Female" },
  other:  { color:"#7c3aed", bg:"#f3eeff", border:"#ddd6fe", label:"Other"  },
}[g ?? "other"] ?? { color:"#7c3aed", bg:"#f3eeff", border:"#ddd6fe", label: g || "—" });

const initials = (name?: string) =>
  (name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2eaf0", overflow:"hidden", boxShadow:"0 2px 10px rgba(30,45,60,.06)" }}>
      <div style={{ padding:"13px 18px", borderBottom:"1px solid #f0f4f8", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:30, height:30, borderRadius:8, background:"#fff7ed", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <i className={`fa-solid ${icon}`} style={{ fontSize:13, color:"#FF9B51" }} />
        </div>
        <span style={{ fontSize:14, fontWeight:900, color:"#1f2d36" }}>{title}</span>
      </div>
      <div style={{ padding:"6px 18px 16px" }}>{children}</div>
    </div>
  );
}

function InfoRow({ icon, label, value, mono = false }: { icon: string; label: string; value?: string | null; mono?: boolean }) {
  const empty = !value;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #f5f7f9" }}>
      <i className={`fa-solid ${icon}`} style={{ width:14, textAlign:"center", fontSize:11, color: empty ? "#d4dde2" : "#FF9B51", flexShrink:0 }} />
      <span style={{ fontSize:12, fontWeight:700, color:"#6a7882", flex:1 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:800, color: empty ? "#d4dde2" : "#1f2d36", fontFamily: mono ? "monospace" : "inherit" }}>
        {empty ? "—" : value}
      </span>
    </div>
  );
}

function DonutRing({ pct, color, size = 80, stroke = 10 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const arc  = (pct / 100) * circ;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TeacherStudentDetailPage({ studentId }: Props) {
  const router     = useRouter();
  const { activeYear } = useAcademicYear();

  const { data: student, loading: sLoad } = useApi<any>(
    studentId ? `/students/${studentId}` : "", [studentId]
  );
  const { data: enrollments, loading: eLoad } = useApi<any[]>(
    studentId && activeYear?.id
      ? `/students/enrollments?student_id=${studentId}&academic_year_id=${activeYear.id}`
      : "",
    [studentId, activeYear?.id]
  );
  // Yearly summary
  const { data: yearlySummary } = useApi<any>(
    studentId && activeYear?.id
      ? `/attendance/student/${studentId}/summary?academic_year_id=${activeYear.id}`
      : "",
    [studentId, activeYear?.id]
  );
  // Current month
  const now      = new Date();
  const { data: currMonthData } = useApi<any>(
    studentId
      ? `/attendance/student/${studentId}/monthly?year=${now.getFullYear()}&month=${now.getMonth()+1}`
      : "",
    [studentId]
  );
  // Previous month
  const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { data: prevMonthData } = useApi<any>(
    studentId
      ? `/attendance/student/${studentId}/monthly?year=${prevDate.getFullYear()}&month=${prevDate.getMonth()+1}`
      : "",
    [studentId]
  );

  const loading    = sLoad || eLoad;
  const enrollment = enrollments?.[0] ?? null;
  const g          = gInfo(student?.gender);

  // Attendance helpers
  const countStatus = (records: any[] = [], s: string) => records.filter(r => r.status === s).length;
  const monthRecords = (data: any): any[] => Array.isArray(data) ? data : (data?.records ?? []);

  const currRecs = monthRecords(currMonthData);
  const prevRecs = monthRecords(prevMonthData);

  const currMonthName = now.toLocaleDateString("en-IN", { month:"long", year:"numeric" });
  const prevMonthName = prevDate.toLocaleDateString("en-IN", { month:"long", year:"numeric" });

  const yearly = {
    present: Number(yearlySummary?.total_present ?? 0),
    absent:  Number(yearlySummary?.total_absent  ?? 0),
    leave:   Number(yearlySummary?.total_leave   ?? 0),
    working: Number(yearlySummary?.total_working_days ?? 0),
  };
  const yearlyTotal = yearly.present + yearly.absent + yearly.leave;
  const yearlyPct   = yearlyTotal > 0 ? Math.round((yearly.present / yearlyTotal) * 100) : 0;
  const yearlyColor = yearlyPct >= 75 ? "#12805c" : yearlyPct >= 50 ? "#c46a14" : "#b42318";

  const monthStat = (recs: any[]) => ({
    present: countStatus(recs, "present"),
    absent:  countStatus(recs, "absent"),
    leave:   countStatus(recs, "leave"),
    total:   recs.length,
  });
  const curr = monthStat(currRecs);
  const prev = monthStat(prevRecs);
  const currPct = curr.total > 0 ? Math.round((curr.present / curr.total) * 100) : 0;
  const prevPct = prev.total > 0 ? Math.round((prev.present / prev.total) * 100) : 0;
  const currColor = currPct >= 75 ? "#12805c" : currPct >= 50 ? "#c46a14" : "#b42318";
  const prevColor = prevPct >= 75 ? "#12805c" : prevPct >= 50 ? "#c46a14" : "#b42318";

  return (
    <>
      <style>{`
        .tsd { min-height:100vh; background:#f0f4f8; }
        .tsd-wrap { padding:20px; max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        @media(min-width:760px){ .tsd-wrap{ padding:28px 32px 60px; } }
        .tsd-grid { display:grid; grid-template-columns:1fr; gap:16px; }
        @media(min-width:760px){ .tsd-grid{ grid-template-columns:300px 1fr; align-items:start; } }
        .att-month-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:480px){ .att-month-grid{ grid-template-columns:1fr; } }
      `}</style>

      <div className="tsd">
        <Topbar title="Student Profile" subtitle="Detailed student information" />
        <div className="tsd-wrap">

          {/* Back */}
          <button onClick={() => router.back()}
            style={{ alignSelf:"flex-start", display:"flex", alignItems:"center", gap:7, padding:"8px 16px", borderRadius:9, border:"1px solid #dce5e9", background:"#fff", fontSize:13, fontWeight:800, color:"#475569", cursor:"pointer" }}>
            <i className="fa-solid fa-arrow-left" style={{ fontSize:11 }} /> Back to My Students
          </button>

          {loading ? (
            <div style={{ padding:"6rem", textAlign:"center" }}><Spinner size={32} color="#FF9B51" /></div>
          ) : !student ? (
            <div style={{ padding:"4rem", textAlign:"center", background:"#fff", borderRadius:14, border:"1px solid #dce5e9" }}>
              <i className="fa-solid fa-user-slash" style={{ fontSize:40, color:"#d4dde2", display:"block", marginBottom:14 }} />
              <p style={{ fontSize:15, fontWeight:800, color:"#1f2d36", margin:0 }}>Student not found</p>
            </div>
          ) : (
            <div className="tsd-grid">

              {/* ══ LEFT COLUMN ══ */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                {/* Profile hero card */}
                <div style={{ background:"#fff", borderRadius:16, border:"1px solid #e2eaf0", overflow:"hidden", boxShadow:"0 4px 16px rgba(30,45,60,.08)" }}>
                  {/* Banner */}
                  <div style={{ height:80, background:`linear-gradient(135deg, #1e2d38 0%, ${g.color}88 100%)`, position:"relative" }}>
                    <div style={{ position:"absolute", bottom:-28, left:20 }}>
                      <div style={{ width:56, height:56, borderRadius:14, background:g.bg, border:`3px solid #fff`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:g.color, boxShadow:"0 4px 14px rgba(0,0,0,.12)" }}>
                        {initials(student.full_name)}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding:"36px 20px 18px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <h1 style={{ margin:0, fontSize:18, fontWeight:900, color:"#1f2d36" }}>{student.full_name}</h1>
                      <span style={{ padding:"2px 9px", borderRadius:99, fontSize:11, fontWeight:800, background:g.bg, color:g.color, border:`1px solid ${g.border}`, flexShrink:0 }}>{g.label}</span>
                    </div>
                    {enrollment && (
                      <p style={{ margin:"0 0 14px", fontSize:12, fontWeight:700, color:"#6a7882" }}>
                        {enrollment.class_name} · Section {enrollment.section_name}
                        {enrollment.roll_number && <> · <strong style={{ color:"#1f2d36" }}>Roll #{enrollment.roll_number}</strong></>}
                      </p>
                    )}

                    {/* Quick chips */}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {[
                        student.blood_group    && { icon:"fa-droplet",       val: student.blood_group,              bg:"#fde7e7", color:"#b42318" },
                        student.date_of_birth  && { icon:"fa-cake-candles",  val: fmtDate(student.date_of_birth),   bg:"#fff7ed", color:"#c46a14" },
                        student.nationality    && { icon:"fa-flag",          val: student.nationality,              bg:"#e8f0fe", color:"#1a73e8" },
                      ].filter(Boolean).map((c: any) => (
                        <div key={c.icon} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:8, background:c.bg, fontSize:11, fontWeight:700, color:c.color }}>
                          <i className={`fa-solid ${c.icon}`} style={{ fontSize:10 }} /> {c.val}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Info */}
                <SectionCard title="Quick Info" icon="fa-tags">
                  <InfoRow icon="fa-id-badge"     label="Admission No."   value={student.admission_number} mono />
                  <InfoRow icon="fa-list-ol"      label="Roll Number"     value={enrollment?.roll_number?.toString() || "Not assigned"} />
                  <InfoRow icon="fa-person"        label="Guardian"        value={student.guardian_name} />
                  <InfoRow icon="fa-phone"         label="Parent Phone"    value={student.guardian_phone} />
                  <InfoRow icon="fa-calendar-plus" label="Admitted On"     value={fmtDate(student.admission_date)} />
                </SectionCard>

                {/* Guardian */}
                <SectionCard title="Guardian" icon="fa-shield-halved">
                  <InfoRow icon="fa-person-shelter" label="Name"         value={student.guardian_name} />
                  <InfoRow icon="fa-people-roof"    label="Relation"     value={student.guardian_relation} />
                  <InfoRow icon="fa-phone-flip"     label="Phone"        value={student.guardian_phone} />
                  <InfoRow icon="fa-envelope"       label="Email"        value={student.guardian_email} />
                </SectionCard>
              </div>

              {/* ══ RIGHT COLUMN ══ */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                {/* ── Attendance Section ── */}
                <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2eaf0", overflow:"hidden", boxShadow:"0 2px 10px rgba(30,45,60,.06)" }}>
                  <div style={{ padding:"13px 18px", borderBottom:"1px solid #f0f4f8", display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:30, height:30, borderRadius:8, background:"#fff7ed", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <i className="fa-solid fa-chart-pie" style={{ fontSize:13, color:"#FF9B51" }} />
                    </div>
                    <span style={{ fontSize:14, fontWeight:900, color:"#1f2d36" }}>Attendance Overview</span>
                  </div>
                  <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:16 }}>

                    {/* Yearly */}
                    <div style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 16px", borderRadius:12, background:"#f7fafb", border:"1px solid #e2eaf0", borderLeft:`4px solid ${yearlyColor}` }}>
                      <div style={{ position:"relative", flexShrink:0 }}>
                        <DonutRing pct={yearlyPct} color={yearlyColor} size={80} stroke={10} />
                        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                          <span style={{ fontSize:14, fontWeight:900, color:"#1f2d36" }}>{yearlyPct}%</span>
                          <span style={{ fontSize:8, fontWeight:700, color:"#6a7882" }}>yearly</span>
                        </div>
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:900, color:"#1f2d36" }}>Full Year · {activeYear?.year_name}</p>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          {[
                            { label:"Present", val:yearly.present, color:"#12805c" },
                            { label:"Absent",  val:yearly.absent,  color:"#b42318" },
                            { label:"Leave",   val:yearly.leave,   color:"#7c3aed" },
                          ].map(r => (
                            <div key={r.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ width:7, height:7, borderRadius:2, background:r.color, flexShrink:0 }} />
                              <span style={{ fontSize:11, fontWeight:600, color:"#6a7882", flex:1 }}>{r.label}</span>
                              <strong style={{ fontSize:12, fontWeight:900, color:r.color }}>{r.val}</strong>
                            </div>
                          ))}
                          {yearly.working > 0 && (
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4, paddingTop:6, borderTop:"1px solid #e2eaf0" }}>
                              <span style={{ width:7, height:7, borderRadius:2, background:"#64748b", flexShrink:0 }} />
                              <span style={{ fontSize:11, fontWeight:600, color:"#6a7882", flex:1 }}>Working Days</span>
                              <strong style={{ fontSize:12, fontWeight:900, color:"#1f2d36" }}>{yearly.working}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Monthly — current + previous */}
                    <div className="att-month-grid">
                      {[
                        { label: currMonthName, stat: curr, pct: currPct, color: currColor },
                        { label: prevMonthName, stat: prev, pct: prevPct, color: prevColor },
                      ].map(m => (
                        <div key={m.label} style={{ padding:"13px 14px", borderRadius:12, background:"#f7fafb", border:"1px solid #e2eaf0", borderLeft:`4px solid ${m.color}` }}>
                          <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:900, color:"#1f2d36" }}>{m.label}</p>
                          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <div style={{ position:"relative", flexShrink:0 }}>
                              <DonutRing pct={m.pct} color={m.color} size={56} stroke={7} />
                              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                <span style={{ fontSize:11, fontWeight:900, color:"#1f2d36" }}>{m.pct}%</span>
                              </div>
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:4, flex:1 }}>
                              {[
                                { label:"P", val:m.stat.present, color:"#12805c", bg:"#e2f6ee" },
                                { label:"A", val:m.stat.absent,  color:"#b42318", bg:"#fde7e7" },
                                { label:"Lv",val:m.stat.leave,   color:"#7c3aed", bg:"#f3eeff" },
                              ].map(r => (
                                <div key={r.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                                  <span style={{ fontSize:9, fontWeight:800, color:r.color, background:r.bg, padding:"1px 5px", borderRadius:4, flexShrink:0 }}>{r.label}</span>
                                  <strong style={{ fontSize:12, fontWeight:900, color:r.color, marginLeft:"auto" }}>{r.val}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <SectionCard title="Personal Details" icon="fa-user">
                  <InfoRow icon="fa-cake-candles"  label="Date of Birth" value={fmtDate(student.date_of_birth)} />
                  <InfoRow icon="fa-venus-mars"    label="Gender"        value={g.label} />
                  <InfoRow icon="fa-droplet"       label="Blood Group"   value={student.blood_group} />
                  <InfoRow icon="fa-earth-asia"    label="Religion"      value={student.religion} />
                  <InfoRow icon="fa-people-group"  label="Ethnicity"     value={student.ethnicity} />
                  <InfoRow icon="fa-flag"          label="Nationality"   value={student.nationality} />
                </SectionCard>

                {/* Academic */}
                <SectionCard title="Academic Info" icon="fa-graduation-cap">
                  <InfoRow icon="fa-id-badge"      label="Admission No."     value={student.admission_number} mono />
                  <InfoRow icon="fa-calendar-plus" label="Admission Date"    value={fmtDate(student.admission_date)} />
                  <InfoRow icon="fa-chalkboard"    label="Class & Section"   value={enrollment ? `${enrollment.class_name} — Section ${enrollment.section_name}` : null} />
                  <InfoRow icon="fa-list-ol"       label="Roll Number"       value={enrollment?.roll_number?.toString()} />
                  <InfoRow icon="fa-file-lines"    label="Registration No."  value={enrollment?.registration_number} mono />
                  <InfoRow icon="fa-hashtag"       label="Symbol Number"     value={enrollment?.symbol_number} mono />
                </SectionCard>

                {/* Contact */}
                <SectionCard title="Contact" icon="fa-address-book">
                  <InfoRow icon="fa-phone"      label="Phone"   value={student.phone} />
                  <InfoRow icon="fa-envelope"   label="Email"   value={student.email} />
                  <InfoRow icon="fa-city"       label="City"    value={student.city} />
                  <InfoRow icon="fa-map"        label="State"   value={student.state} />
                  <InfoRow icon="fa-earth-asia" label="Country" value={student.country} />
                </SectionCard>

              </div>
            </div>
          )}

          {/* Note */}
          <div style={{ padding:"11px 16px", borderRadius:10, background:"#fff7ed", border:"1px solid #fed7aa", borderLeft:"4px solid #FF9B51", display:"flex", gap:9, alignItems:"flex-start" }}>
            <i className="fa-solid fa-circle-info" style={{ color:"#c2410c", fontSize:13, flexShrink:0, marginTop:1 }} />
            <span style={{ fontSize:12, fontWeight:700, color:"#92400e" }}>
              You can only edit <strong>Roll Number</strong> and <strong>Remarks</strong> from the students list. All other details can only be changed by the school admin.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
