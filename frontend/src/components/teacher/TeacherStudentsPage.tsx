"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

interface Section {
  id: number;
  name: string;
  class_id: number;
  class_name?: string;
}

interface StudentEnrollment {
  id: number;             // enrollment id
  student_id: number;
  full_name: string;
  admission_number: string;
  photo: string | null;
  gender: string;
  roll_number: string | null;   // se.roll_number
  remarks: string | null;        // se.remarks (enrollment remarks)
  section_id: number;
  section_name: string;
  class_name: string;
  guardian_phone?: string | null;
  guardian_name?: string | null;
  guardian_relation?: string | null;
}

export default function TeacherStudentsPage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const { activeYear } = useAcademicYear();
  const academicYearId = activeYear?.id ?? null;

  const { data: sectionsRaw, loading: sectionsLoading } = useApi<Section[]>("/teachers/me/sections", []);
  const sections: Section[] = sectionsRaw ?? [];

  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const sectionId = selectedSectionId ?? sections[0]?.id ?? null;

  const { data: enrollmentsRaw, loading: studentsLoading, refetch } = useApi<StudentEnrollment[]>(
    sectionId && academicYearId
      ? `/students/enrollments?section_id=${sectionId}&academic_year_id=${academicYearId}`
      : "",
    [sectionId, academicYearId]
  );
  const students: StudentEnrollment[] = enrollmentsRaw ?? [];

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      (s.guardian_name ?? "").toLowerCase().includes(q) ||
      (s.roll_number ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // ── Inline edit ───────────────────────────────────────────────────────────
  const [editingId,   setEditingId  ] = useState<number | null>(null);
  const [editRoll,    setEditRoll   ] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [saving,      setSaving     ] = useState(false);
  const [savedId,     setSavedId    ] = useState<number | null>(null);

  const startEdit = (s: StudentEnrollment) => {
    setEditingId(s.id);
    setEditRoll(s.roll_number ?? "");
    setEditRemarks(s.remarks ?? "");
    setSavedId(null);
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = useCallback(async (enrollmentId: number) => {
    setSaving(true);
    try {
      await apiRequest(`/students/enrollments/${enrollmentId}/roll`, {
        method: "PATCH",
        body: JSON.stringify({ roll_number: editRoll.trim() || null, remarks: editRemarks.trim() || null }),
      });
      setSavedId(enrollmentId);
      setEditingId(null);
      refetch?.();
      dispatch(showToast({ type: "success", title: "Saved", message: "Roll number updated." }));
      setTimeout(() => setSavedId(null), 2500);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save" }));
    } finally {
      setSaving(false);
    }
  }, [editRoll, editRemarks, refetch, dispatch]);

  const currentSection = sections.find(s => s.id === sectionId);
  const sectionLabel = currentSection
    ? `${currentSection.class_name ? currentSection.class_name + " — " : ""}${currentSection.name}`
    : "";

  const gInfo = (gender: string) => {
    if (gender === "male")   return { color: "#1a73e8", bg: "#e8f0fe", label: "Male"   };
    if (gender === "female") return { color: "#c2185b", bg: "#fce4ec", label: "Female" };
    return                          { color: "#7c3aed", bg: "#f3eeff", label: gender || "—" };
  };

  return (
    <>
      <style>{`
        .tsp { min-height:100vh; background:#eef2f3; }
        .tsp-main { padding:20px; max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        @media(min-width:720px){ .tsp-main{ padding:28px 28px 56px; } }
        .tsp-card { background:#fff; border-radius:14px; border:1px solid #dce5e9; overflow:hidden; box-shadow:0 2px 8px rgba(31,45,54,.05); }
        .tsp-th { padding:10px 16px; text-align:left; font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; white-space:nowrap; border-bottom:2px solid #eef2f3; background:#f7fafb; }
        .tsp-td { padding:13px 16px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
        .tsp-tr:hover td { background:#fafcfc; }
        .tsp-input { padding:6px 10px; border-radius:7px; border:1.5px solid #FF9B51; font-size:12px; font-weight:700; outline:none; background:#fff; width:100%; }
        @media(max-width:680px){ .hide-sm{ display:none; } }
        /* Mobile action: show only eye icon button, hide text label */
        @media(max-width:680px){
          .view-label { display:none; }
        }
      `}</style>

      <div className="tsp">
        <Topbar title="My Students" subtitle="Students enrolled in your coordinated sections" />
        <div className="tsp-main">

          {sectionsLoading ? (
            <div style={{ padding:"3rem", textAlign:"center" }}><Spinner size={28} color="#FF9B51" /></div>
          ) : sections.length === 0 ? (
            <div className="tsp-card" style={{ padding:"3rem", textAlign:"center" }}>
              <i className="fa-solid fa-chalkboard-user" style={{ fontSize:36, color:"#d4dde2", display:"block", marginBottom:14 }} />
              <p style={{ fontSize:15, fontWeight:800, color:"#1e293b", margin:"0 0 6px" }}>No sections assigned</p>
              <p style={{ fontSize:13, color:"#6a7882", margin:0 }}>Ask your admin to assign you as a section coordinator.</p>
            </div>
          ) : (
            <>
              {/* ── Section tabs ── */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {sections.map(sec => {
                  const active = sec.id === sectionId;
                  const label  = sec.class_name ? `${sec.class_name} — ${sec.name}` : sec.name;
                  return (
                    <button key={sec.id}
                      onClick={() => { setSelectedSectionId(sec.id); setSearch(""); setEditingId(null); }}
                      style={{ padding:"9px 18px", borderRadius:10, cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit", transition:"all .15s",
                        border:     active ? "2px solid #FF9B51" : "1.5px solid #dce5e9",
                        background: active ? "#FF9B51" : "#fff",
                        color:      active ? "#fff"    : "#475569",
                        boxShadow:  active ? "0 4px 12px rgba(255,155,81,.3)" : "none",
                      }}>
                      <i className="fa-solid fa-chalkboard" style={{ marginRight:7, fontSize:12 }} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* ── Stats ── */}
              {!studentsLoading && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
                  {[
                    { icon:"fa-users",            label:"Total",         val:students.length,                               color:"#1e293b", bg:"#f7fafb",  border:"#e2e8f0" },
                    { icon:"fa-mars",             label:"Male",          val:students.filter(s => s.gender === "male").length,   color:"#1a73e8", bg:"#e8f0fe",  border:"#bfdbfe" },
                    { icon:"fa-venus",            label:"Female",        val:students.filter(s => s.gender === "female").length, color:"#c2185b", bg:"#fce4ec",  border:"#fbcfe8" },
                    { icon:"fa-list-ol",          label:"Has Roll No.",  val:students.filter(s => !!s.roll_number).length,      color:"#12805c", bg:"#e2f6ee",  border:"#a7f3d0" },
                    { icon:"fa-circle-question",  label:"No Roll No.",   val:students.filter(s => !s.roll_number).length,       color:"#c46a14", bg:"#fff1df",  border:"#fde68a" },
                  ].map(st => (
                    <div key={st.label} style={{ background:st.bg, border:`1px solid ${st.border}`, borderRadius:11, padding:"13px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                        <i className={`fa-solid ${st.icon}`} style={{ color:st.color, fontSize:13 }} />
                        <span style={{ fontSize:10, fontWeight:900, color:st.color, textTransform:"uppercase", letterSpacing:"0.5px" }}>{st.label}</span>
                      </div>
                      <strong style={{ fontSize:22, fontWeight:900, color:st.color }}>{st.val}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Table card ── */}
              <div className="tsp-card">
                <div style={{ padding:"14px 18px", borderBottom:"1px solid #eef2f3", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  <div>
                    <p style={{ margin:0, fontSize:14, fontWeight:900, color:"#1f2d36" }}>{sectionLabel}</p>
                    <p style={{ margin:"2px 0 0", fontSize:11, fontWeight:700, color:"#6a7882" }}>
                      Click <strong>Edit</strong> to update roll number · Click <strong>View</strong> to open student profile
                    </p>
                  </div>
                  <div style={{ position:"relative" }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"#94a3b8" }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search name / father / roll…"
                      style={{ paddingLeft:30, paddingRight:10, height:36, borderRadius:8, border:"1px solid #d4dde2", fontSize:12, fontWeight:700, outline:"none", width:220, background:"#f8fafc" }} />
                  </div>
                </div>

                {studentsLoading ? (
                  <div style={{ padding:"3rem", textAlign:"center" }}><Spinner size={26} color="#FF9B51" /></div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding:"3rem", textAlign:"center" }}>
                    <i className="fa-solid fa-user-slash" style={{ fontSize:30, color:"#d4dde2", display:"block", marginBottom:10 }} />
                    <p style={{ fontSize:13, color:"#6a7882", margin:0 }}>
                      {search ? "No students match your search." : "No students enrolled in this section."}
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr>
                          <th className="tsp-th" style={{ width:48 }}>#</th>
                          <th className="tsp-th">Student</th>
                          <th className="tsp-th hide-sm">Guardian</th>
                          <th className="tsp-th hide-sm">Gender</th>
                          <th className="tsp-th">Roll No.</th>
                          <th className="tsp-th hide-sm">Parent's Phone</th>
                          <th className="tsp-th" style={{ textAlign:"right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s, idx) => {
                          const isEditing = editingId === s.id;
                          const isSaved   = savedId   === s.id;
                          const g = gInfo(s.gender);

                          return (
                            <tr key={s.id} className={`tsp-tr${isEditing ? " editing" : ""}${isSaved ? " saved" : ""}`}>

                              {/* # (roll number or index) */}
                              <td className="tsp-td" style={{ fontSize:13, fontWeight:900, color:"#94a3b8", textAlign:"center" }}>
                                {s.roll_number || idx + 1}
                              </td>

                              {/* Student name only — no admission number */}
                              <td className="tsp-td">
                                <p style={{ margin:0, fontSize:13, fontWeight:900, color:"#1f2d36" }}>{s.full_name}</p>
                              </td>

                              {/* Guardian Name */}
                              <td className="tsp-td hide-sm" style={{ fontSize:12, fontWeight:700, color:"#475569" }}>
                                {s.guardian_name
                                  ? <span>{s.guardian_name} {s.guardian_relation ? <span style={{ fontSize:10, color:"#94a3b8" }}>({s.guardian_relation})</span> : null}</span>
                                  : <span style={{ color:"#d4dde2" }}>—</span>}
                              </td>

                              {/* Gender */}
                              <td className="tsp-td hide-sm">
                                <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:800, background:g.bg, color:g.color }}>
                                  {g.label}
                                </span>
                              </td>

                              {/* Roll Number */}
                              <td className="tsp-td">
                                {isEditing ? (
                                  <input className="tsp-input" value={editRoll}
                                    onChange={e => setEditRoll(e.target.value)}
                                    placeholder="e.g. 1" autoFocus style={{ width:72 }} />
                                ) : (
                                  <span style={{ fontSize:14, fontWeight:900, color:s.roll_number ? "#1f2d36" : "#d4dde2" }}>
                                    {s.roll_number || "—"}
                                  </span>
                                )}
                              </td>

                              {/* Parent's Phone */}
                              <td className="tsp-td hide-sm">
                                {s.guardian_phone
                                  ? <span style={{ fontSize:12, fontWeight:700, color:"#1f2d36", display:"flex", alignItems:"center", gap:5 }}>
                                      <i className="fa-solid fa-phone" style={{ fontSize:10, color:"#94a3b8" }} /> {s.guardian_phone}
                                    </span>
                                  : <span style={{ color:"#d4dde2" }}>—</span>
                                }
                              </td>

                              {/* Action — View only. Edit is in the profile page. */}
                              <td className="tsp-td" style={{ textAlign:"right" }}>
                                <button
                                  onClick={() => router.push(`/teacher/students/${s.student_id}`)}
                                  style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #bfdbfe", background:"#e8f0fe", color:"#1a73e8", fontSize:12, fontWeight:800, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5 }}>
                                  <i className="fa-solid fa-eye" style={{ fontSize:12 }} />
                                  <span className="view-label">View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Info note */}
              <div style={{ padding:"11px 16px", borderRadius:10, background:"#fff7ed", border:"1px solid #fed7aa", display:"flex", gap:9, alignItems:"flex-start" }}>
                <i className="fa-solid fa-circle-info" style={{ color:"#c2410c", fontSize:13, flexShrink:0, marginTop:1 }} />
                <span style={{ fontSize:12, fontWeight:700, color:"#92400e" }}>
                  You can edit <strong>Roll Number</strong> and <strong>Remarks</strong>. All other student details can only be changed by the school admin.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
