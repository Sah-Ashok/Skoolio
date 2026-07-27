"use client";

import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";

interface Props { studentId: number; }

const C = {
  brand: "#FF9B51", brandLight: "#fff7ed", brandDark: "#c2410c",
  dark: "#1f2d36", mid: "#6a7882", light: "#eef2f3", white: "#fff",
  border: "#dce5e9", green: "#12805c", greenBg: "#e2f6ee",
  blue: "#1a73e8", blueBg: "#e8f0fe",
  pink: "#c2185b", pinkBg: "#fce4ec",
  purple: "#7c3aed", purpleBg: "#f3eeff",
};

const fmtDate = (d?: string | null, isBS = false) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function InfoRow({ icon, label, value, mono = false }: { icon: string; label: string; value?: string | null; mono?: boolean }) {
  const empty = !value || value === "—";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.light}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: C.light, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 12, color: empty ? "#c6d0d7" : C.brand }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: empty ? "#c6d0d7" : C.dark, fontFamily: mono ? "monospace" : "inherit" }}>
          {empty ? "Not available" : value}
        </p>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 8px rgba(31,45,54,.06)" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.light}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.brandLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`fa-solid ${icon}`} style={{ fontSize: 12, color: C.brand }} />
        </div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.dark }}>{title}</p>
      </div>
      <div style={{ padding: "4px 20px 16px" }}>{children}</div>
    </div>
  );
}

export default function TeacherStudentDetailPage({ studentId }: Props) {
  const router  = useRouter();
  const { activeYear } = useAcademicYear();
  const { formatDate, isBS } = useDateFormat();

  // Fetch student profile
  const { data: student, loading: sLoad } = useApi<any>(
    studentId ? `/students/${studentId}` : "", [studentId]
  );

  // Fetch enrollment for roll no + section info
  const { data: enrollments, loading: eLoad } = useApi<any[]>(
    studentId && activeYear?.id
      ? `/students/enrollments?student_id=${studentId}&academic_year_id=${activeYear.id}`
      : "",
    [studentId, activeYear?.id]
  );

  // Fetch attendance summary
  const { data: attSummary } = useApi<any>(
    studentId && activeYear?.id
      ? `/attendance/student/${studentId}/summary?academic_year_id=${activeYear.id}`
      : "",
    [studentId, activeYear?.id]
  );

  const loading = sLoad || eLoad;
  const enrollment = enrollments?.[0] ?? null;

  const gColor = student?.gender === "male"   ? C.blue  : student?.gender === "female" ? C.pink   : C.purple;
  const gBg    = student?.gender === "male"   ? C.blueBg : student?.gender === "female" ? C.pinkBg : C.purpleBg;
  const gLabel = student?.gender === "male"   ? "Male"   : student?.gender === "female" ? "Female"  : student?.gender || "—";

  const initials = (student?.full_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const present = Number(attSummary?.total_present  ?? 0);
  const absent  = Number(attSummary?.total_absent   ?? 0);
  const leave   = Number(attSummary?.total_leave    ?? 0);
  const total   = present + absent + leave;
  const pct     = total > 0 ? Math.round((present / total) * 100) : null;

  return (
    <>
      <style>{`
        .tsd-root { min-height:100vh; background:${C.light}; }
        .tsd-main { padding:20px; max-width:960px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        @media(min-width:720px){ .tsd-main{ padding:28px 28px 56px; } }
        .tsd-grid { display:grid; grid-template-columns:1fr; gap:16px; }
        @media(min-width:720px){ .tsd-grid{ grid-template-columns:300px 1fr; align-items:start; } }
        .tsd-stat { flex:1; padding:14px 16px; border-radius:12px; text-align:center; }
      `}</style>

      <div className="tsd-root">
        <Topbar title="Student Profile" subtitle="Detailed student information" />
        <div className="tsd-main">

          {/* Back button */}
          <button onClick={() => router.back()}
            style={{ alignSelf:"flex-start", display:"flex", alignItems:"center", gap:7, padding:"8px 16px", borderRadius:9, border:`1px solid ${C.border}`, background:C.white, fontSize:13, fontWeight:800, color:C.mid, cursor:"pointer" }}>
            <i className="fa-solid fa-arrow-left" style={{ fontSize:11 }} /> Back to My Students
          </button>

          {loading ? (
            <div style={{ padding:"5rem", textAlign:"center" }}><Spinner size={32} color={C.brand} /></div>
          ) : !student ? (
            <div style={{ padding:"4rem", textAlign:"center", background:C.white, borderRadius:14, border:`1px solid ${C.border}` }}>
              <i className="fa-solid fa-user-slash" style={{ fontSize:40, color:"#d4dde2", display:"block", marginBottom:14 }} />
              <p style={{ fontSize:15, fontWeight:800, color:C.dark }}>Student not found</p>
            </div>
          ) : (
            <div className="tsd-grid">

              {/* ── Left column: profile card ── */}
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

                {/* Profile hero */}
                <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 4px 16px rgba(31,45,54,.08)" }}>
                  {/* Gradient banner */}
                  <div style={{ height:72, background:"linear-gradient(135deg,#25343F 0%,#1e2d38 60%,#FF9B51 100%)" }} />
                  {/* Avatar */}
                  <div style={{ padding:"0 20px 20px", marginTop:-32 }}>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:12, marginBottom:14 }}>
                      {student.photo ? (
                        <img src={student.photo} alt={student.full_name}
                          style={{ width:64, height:64, borderRadius:14, border:"3px solid #fff", objectFit:"cover", boxShadow:"0 4px 12px rgba(0,0,0,.15)" }} />
                      ) : (
                        <div style={{ width:64, height:64, borderRadius:14, background:gBg, color:gColor, border:"3px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, boxShadow:"0 4px 12px rgba(0,0,0,.12)" }}>
                          {initials}
                        </div>
                      )}
                      <div style={{ paddingBottom:4 }}>
                        <span style={{ fontSize:11, fontWeight:800, color:gColor, background:gBg, padding:"2px 10px", borderRadius:99, display:"inline-block", marginBottom:4 }}>
                          {gLabel}
                        </span>
                      </div>
                    </div>
                    <h1 style={{ margin:"0 0 4px", fontSize:18, fontWeight:900, color:C.dark }}>{student.full_name}</h1>
                    {enrollment && (
                      <p style={{ margin:0, fontSize:12, fontWeight:700, color:C.mid }}>
                        {enrollment.class_name} · Section {enrollment.section_name}
                        {enrollment.roll_number && ` · Roll #${enrollment.roll_number}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Attendance mini-summary */}
                {attSummary && (
                  <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, padding:"16px 20px", boxShadow:"0 2px 8px rgba(31,45,54,.06)" }}>
                    <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:900, color:C.dark }}>
                      <i className="fa-solid fa-chart-pie" style={{ color:C.brand, marginRight:7 }} />
                      Attendance This Year
                    </p>
                    {pct !== null && (
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                        {/* Mini ring */}
                        <div style={{ position:"relative", flexShrink:0 }}>
                          <svg viewBox="0 0 60 60" width={54} height={54} style={{ transform:"rotate(-90deg)" }}>
                            <circle cx="30" cy="30" r="22" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                            <circle cx="30" cy="30" r="22" fill="none"
                              stroke={pct >= 75 ? "#12805c" : pct >= 50 ? "#c46a14" : "#b42318"} strokeWidth="8"
                              strokeDasharray={`${(pct/100)*138.2} 138.2`} strokeLinecap="round" />
                          </svg>
                          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <span style={{ fontSize:11, fontWeight:900, color:C.dark }}>{pct}%</span>
                          </div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:5, flex:1 }}>
                          {[
                            { label:"Present", val:present, color:C.green  },
                            { label:"Absent",  val:absent,  color:"#b42318"},
                            { label:"Leave",   val:leave,   color:C.purple },
                          ].map(r => (
                            <div key={r.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ width:7, height:7, borderRadius:2, background:r.color, flexShrink:0 }} />
                              <span style={{ fontSize:11, color:C.mid, fontWeight:600 }}>{r.label}</span>
                              <span style={{ fontSize:11, fontWeight:900, color:C.dark, marginLeft:"auto" }}>{r.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick badges */}
                <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, padding:"16px 20px", boxShadow:"0 2px 8px rgba(31,45,54,.06)" }}>
                  <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:900, color:C.dark }}>
                    <i className="fa-solid fa-tags" style={{ color:C.brand, marginRight:7 }} />
                    Quick Info
                  </p>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      { label:"Admission No.",  val: student.admission_number,         icon:"fa-id-badge",    mono:true  },
                      { label:"Roll Number",    val: enrollment?.roll_number || "Not assigned", icon:"fa-list-ol" },
                      { label:"Guardian",       val: student.guardian_name,             icon:"fa-person"      },
                      { label:"Date of Birth",  val: fmtDate(student.date_of_birth),   icon:"fa-cake-candles" },
                    ].map(f => (
                      <div key={f.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.light}` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <i className={`fa-solid ${f.icon}`} style={{ fontSize:11, color:"#94a3b8", width:14, textAlign:"center" }} />
                          <span style={{ fontSize:12, fontWeight:700, color:C.mid }}>{f.label}</span>
                        </div>
                        <span style={{ fontSize:12, fontWeight:900, color:f.val && f.val !== "Not assigned" ? C.dark : "#d4dde2", fontFamily: f.mono ? "monospace" : "inherit" }}>
                          {f.val || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Right column: detail cards ── */}
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

                {/* Personal Details */}
                <Card title="Personal Details" icon="fa-user">
                  <InfoRow icon="fa-user"          label="Full Name"       value={student.full_name} />
                  <InfoRow icon="fa-cake-candles"  label="Date of Birth"   value={fmtDate(student.date_of_birth)} />
                  <InfoRow icon="fa-venus-mars"    label="Gender"          value={gLabel} />
                  <InfoRow icon="fa-droplet"       label="Blood Group"     value={student.blood_group} />
                  <InfoRow icon="fa-earth-asia"    label="Religion"        value={student.religion} />
                  <InfoRow icon="fa-flag"          label="Nationality"     value={student.nationality} />
                </Card>

                {/* Academic Info */}
                <Card title="Academic Info" icon="fa-graduation-cap">
                  <InfoRow icon="fa-id-badge"      label="Admission Number"  value={student.admission_number} mono />
                  <InfoRow icon="fa-calendar-plus" label="Admission Date"    value={fmtDate(student.admission_date)} />
                  <InfoRow icon="fa-list-ol"       label="Roll Number"       value={enrollment?.roll_number || "Not assigned"} />
                  <InfoRow icon="fa-chalkboard"    label="Class & Section"   value={enrollment ? `${enrollment.class_name} — Section ${enrollment.section_name}` : "—"} />
                  <InfoRow icon="fa-file-lines"    label="Registration No."  value={enrollment?.registration_number} mono />
                  <InfoRow icon="fa-hashtag"       label="Symbol Number"     value={enrollment?.symbol_number} mono />
                </Card>

                {/* Contact */}
                <Card title="Contact Information" icon="fa-address-book">
                  <InfoRow icon="fa-phone"         label="Student Phone"   value={student.phone} />
                  <InfoRow icon="fa-envelope"      label="Student Email"   value={student.email} />
                  <InfoRow icon="fa-city"          label="City"            value={student.city} />
                  <InfoRow icon="fa-map"           label="State"           value={student.state} />
                  <InfoRow icon="fa-flag"          label="Country"         value={student.country} />
                </Card>

                {/* Guardian */}
                <Card title="Guardian / Emergency" icon="fa-shield-halved">
                  <InfoRow icon="fa-person-shelter" label="Guardian Name"    value={student.guardian_name} />
                  <InfoRow icon="fa-phone-flip"     label="Guardian Phone"   value={student.guardian_phone} />
                  <InfoRow icon="fa-envelope"       label="Guardian Email"   value={student.guardian_email} />
                  <InfoRow icon="fa-people-roof"    label="Relationship"     value={student.guardian_relation} />
                  <InfoRow icon="fa-briefcase"      label="Occupation"       value={student.guardian_occupation} />
                </Card>

              </div>
            </div>
          )}

          {/* Note */}
          <div style={{ padding:"11px 16px", borderRadius:10, background:"#fff7ed", border:"1px solid #fed7aa", display:"flex", gap:9, alignItems:"flex-start" }}>
            <i className="fa-solid fa-circle-info" style={{ color:C.brandDark, fontSize:13, flexShrink:0, marginTop:1 }} />
            <span style={{ fontSize:12, fontWeight:700, color:"#92400e" }}>
              You can only edit <strong>Roll Number</strong> and <strong>Remarks</strong> from the students list. All other details can only be changed by the school admin.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
