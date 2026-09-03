"use client";

import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import AttendanceOverviewCard from "@/components/shared/AttendanceOverviewCard";


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
      <i className={`fa-solid ${icon}`} style={{ width:14, textAlign:"center", fontSize:11, color: empty ? "#cbd5e1" : "#c6d0d7", flexShrink:0 }} />
      <span style={{ fontSize:12, fontWeight:700, color:"#94a3b8", flex:"0 0 130px" }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color: empty ? "#94a3b8" : "#1f2d36", fontFamily: mono ? "monospace" : "inherit", wordBreak:"break-all" }}>
        {empty ? "—" : value}
      </span>
    </div>
  );
}

export default function TeacherStudentDetailPage({ studentId }: Props) {
  const router                      = useRouter();
  const { activeYear }              = useAcademicYear();
  const { formatDate }              = useDateFormat();

  const { data: student,     loading: sLoad } = useApi<any>(
    studentId ? `/students/${studentId}` : "", [studentId]
  );
  const { data: enrollments, loading: eLoad } = useApi<any[]>(
    studentId && activeYear?.id
      ? `/students/enrollments?student_id=${studentId}&academic_year_id=${activeYear.id}`
      : "",
    [studentId, activeYear?.id]
  );

  const loading    = sLoad || eLoad;
  const enrollment = enrollments?.[0] ?? null;
  const gs         = gStyle(student?.gender);

  // Monthly URL builder for the shared AttendanceOverviewCard
  const attMonthlyUrl = (year: number, month: number): string =>
    studentId && activeYear?.id
      ? `/attendance/student/${studentId}/monthly?year=${year}&month=${month}&academic_year_id=${activeYear.id}`
      : "";

  return (
    <>
      <style>{`
        .tsd { min-height:100vh; background:#eef2f3; font-family: 'Nunito', sans-serif; }
        .tsd-wrap { padding:20px; max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:16px; font-family: 'Nunito', sans-serif; }
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

              {/* Left Column */}
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

                {/* Guardian & Primary Contact */}
                <Card>
                  <CardHead icon="fa-shield-halved" title="Guardian & Primary Contact" />
                  <div style={{ padding:"4px 20px 12px" }}>
                    <Row icon="fa-person-shelter" label="Name"        value={student.guardian_name} />
                    <Row icon="fa-people-roof"    label="Relation"    value={cap(student.guardian_relation)} />
                    <Row icon="fa-phone-flip"     label="Phone"       value={student.guardian_phone} />
                    {student.guardian_email && (
                      <Row icon="fa-envelope"     label="Email"       value={student.guardian_email} />
                    )}
                    {student.guardian_occupation && (
                      <Row icon="fa-briefcase"    label="Occupation"  value={student.guardian_occupation} />
                    )}
                  </div>
                </Card>

                {/* Residence & Contact */}
                <Card>
                  <CardHead icon="fa-address-book" title="Residence & Contact" />
                  <div style={{ padding:"4px 20px 12px" }}>
                    <Row icon="fa-location-dot" label="Address" value={
                      [student.guardian_address, student.city, student.state, student.country]
                        .filter(Boolean)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .join(", ") || null
                    } />
                    {student.phone && (
                      <Row icon="fa-phone"      label="Student Phone" value={student.phone} />
                    )}
                    {student.email && (
                      <Row icon="fa-envelope"   label="Student Email" value={student.email} />
                    )}
                  </div>
                </Card>
              </div>

              {/* Right Column */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                {/* Attendance */}
                <Card>
                  <CardHead icon="fa-chart-pie" title="Attendance Overview" />
                  <div style={{ padding: "14px 18px" }}>
                    <AttendanceOverviewCard
                      activeYear={activeYear}
                      summaryBaseUrl={studentId ? `/attendance/student/${studentId}/summary` : null}
                      monthlyUrl={attMonthlyUrl}
                    />
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
                    {enrollment?.registration_number && (
                      <Row icon="fa-file-lines"  label="Registration No." value={enrollment.registration_number} mono />
                    )}
                    {enrollment?.symbol_number && (
                      <Row icon="fa-hashtag"     label="Symbol Number"    value={enrollment.symbol_number} mono />
                    )}
                    {student.previous_school && (
                      <Row icon="fa-school-flag" label="Previous School"  value={student.previous_school} />
                    )}
                  </div>
                </Card>

                {/* Personal */}
                <Card>
                  <CardHead icon="fa-user" title="Personal Details" />
                  <div style={{ padding:"4px 20px 12px" }}>
                    <Row icon="fa-cake-candles"  label="Date of Birth" value={formatDate(student.date_of_birth)} />
                    <Row icon="fa-venus-mars"    label="Gender"        value={cap(student.gender)} />
                    {student.blood_group && (
                      <Row icon="fa-droplet"     label="Blood Group"   value={student.blood_group} />
                    )}
                    {student.religion && (
                      <Row icon="fa-pray"        label="Religion"      value={student.religion} />
                    )}
                    {student.ethnicity && (
                      <Row icon="fa-people-group" label="Ethnicity"    value={student.ethnicity} />
                    )}
                    {student.nationality && (
                      <Row icon="fa-flag"        label="Nationality"   value={student.nationality} />
                    )}
                    {student.disability && (
                      <Row icon="fa-wheelchair"  label="Disability"    value={student.disability_description ? `Yes (${student.disability_description})` : "Yes"} />
                    )}
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

