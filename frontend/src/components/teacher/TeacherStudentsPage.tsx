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
  id: number; name: string; class_id: number; class_name?: string;
}
interface StudentEnrollment {
  id: number; student_id: number; full_name: string; admission_number: string;
  photo: string | null; gender: string; roll_number: string | null;
  remarks: string | null; section_id: number; section_name: string;
  class_name: string; guardian_phone?: string | null;
  guardian_name?: string | null; guardian_relation?: string | null;
}

const PAGE_SIZE = 10;

const gInfo = (g: string) => ({
  male:   { color:"#1a73e8", bg:"#e8f0fe", border:"#1a73e8", label:"Male"   },
  female: { color:"#c2185b", bg:"#fce4ec", border:"#c2185b", label:"Female" },
  other:  { color:"#7c3aed", bg:"#f3eeff", border:"#7c3aed", label:"Other"  },
}[g] ?? { color:"#7c3aed", bg:"#f3eeff", border:"#7c3aed", label:g || "—" });

const avatar = (name: string) =>
  name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";

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
      (s.roll_number   ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // Pagination
  const [page, setPage]   = useState(1);
  const totalPages        = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated         = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const onSearch = (v: string) => { setSearch(v); setPage(1); };

  // Edit
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
    } finally { setSaving(false); }
  }, [editRoll, editRemarks, refetch, dispatch]);

  const currentSection = sections.find(s => s.id === sectionId);
  const sectionLabel   = currentSection
    ? `${currentSection.class_name ? currentSection.class_name + " — " : ""}${currentSection.name}`
    : "";

  return (
    <>
      <style>{`
        .tsp { min-height:100vh; background:#eef2f3; }
        .tsp-main { padding:20px; max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        @media(min-width:720px){ .tsp-main{ padding:28px 28px 56px; } }
        .tsp-card { background:#fff; border-radius:14px; border:1px solid #dce5e9; overflow:hidden; box-shadow:0 2px 8px rgba(31,45,54,.05); }
        .tsp-th { padding:10px 16px; text-align:left; font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; white-space:nowrap; border-bottom:2px solid #eef2f3; background:#f7fafb; }
        .tsp-td { padding:13px 16px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
        .tsp-tr { transition:background .12s; }
        .tsp-tr:hover td { background:#fafcfc; }
        .tsp-tr:last-child td { border-bottom:none; }
        .tsp-input { padding:6px 10px; border-radius:7px; border:1.5px solid #FF9B51; font-size:12px; font-weight:700; outline:none; background:#fff; }
        .pg-btn { width:32px; height:32px; border-radius:7px; border:1px solid #dce5e9; background:#fff; cursor:pointer; font-size:12px; font-weight:800; color:#475569; display:inline-flex; align-items:center; justify-content:center; transition:all .15s; }
        .pg-btn:hover:not(:disabled) { background:#FF9B51; color:#fff; border-color:#FF9B51; }
        .pg-btn:disabled { opacity:.38; cursor:default; }
        .pg-active { background:#FF9B51 !important; color:#fff !important; border-color:#FF9B51 !important; }
        @media(max-width:680px){ .hide-sm{ display:none; } }
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
          ) : (<>

            {/* ── Section tabs ── */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {sections.map(sec => {
                const active = sec.id === sectionId;
                const label  = sec.class_name ? `${sec.class_name} — ${sec.name}` : sec.name;
                return (
                  <button key={sec.id}
                    onClick={() => { setSelectedSectionId(sec.id); onSearch(""); setEditingId(null); }}
                    style={{ padding:"9px 18px", borderRadius:10, cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit", transition:"all .15s", display:"flex", alignItems:"center", gap:7,
                      border:     active ? "2px solid #FF9B51" : "1.5px solid #dce5e9",
                      background: active ? "#FF9B51"           : "#fff",
                      color:      active ? "#fff"              : "#475569",
                      boxShadow:  active ? "0 4px 12px rgba(255,155,81,.3)" : "none",
                    }}>
                    <i className="fa-solid fa-chalkboard" style={{ fontSize:12 }} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Stats ── */}
            {!studentsLoading && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
                {[
                  { icon:"fa-users",           label:"Total",        val:students.length,                                color:"#1e293b", bg:"#f7fafb", border:"#e2e8f0", left:"#64748b" },
                  { icon:"fa-mars",            label:"Male",         val:students.filter(s=>s.gender==="male").length,   color:"#1a73e8", bg:"#e8f0fe", border:"#bfdbfe", left:"#1a73e8" },
                  { icon:"fa-venus",           label:"Female",       val:students.filter(s=>s.gender==="female").length, color:"#c2185b", bg:"#fce4ec", border:"#fbcfe8", left:"#c2185b" },
                  { icon:"fa-list-ol",         label:"Has Roll No.", val:students.filter(s=>!!s.roll_number).length,     color:"#12805c", bg:"#e2f6ee", border:"#a7f3d0", left:"#12805c" },
                  { icon:"fa-circle-question", label:"No Roll No.",  val:students.filter(s=>!s.roll_number).length,      color:"#c46a14", bg:"#fff7ed", border:"#fde68a", left:"#c46a14" },
                ].map(st => (
                  <div key={st.label} style={{ background:st.bg, border:`1px solid ${st.border}`, borderLeft:`4px solid ${st.left}`, borderRadius:11, padding:"13px 16px", display:"flex", alignItems:"center", gap:12 }}>
                    <i className={`fa-solid ${st.icon}`} style={{ color:st.color, fontSize:16 }} />
                    <div>
                      <strong style={{ fontSize:20, fontWeight:900, color:st.color, display:"block", lineHeight:1 }}>{st.val}</strong>
                      <span style={{ fontSize:10, fontWeight:800, color:st.color, opacity:.75, textTransform:"uppercase", letterSpacing:".4px" }}>{st.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Table card ── */}
            <div className="tsp-card">
              {/* Header */}
              <div style={{ padding:"14px 18px", borderBottom:"1px solid #eef2f3", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:900, color:"#1f2d36" }}>{sectionLabel}</p>
                  <p style={{ margin:"2px 0 0", fontSize:11, fontWeight:700, color:"#6a7882" }}>
                    Click <strong>Edit</strong> to update roll number · Click <strong>View</strong> to open student profile
                  </p>
                </div>
                <div style={{ position:"relative" }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"#94a3b8" }} />
                  <input value={search} onChange={e => onSearch(e.target.value)}
                    placeholder="Search name / guardian / roll…"
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
                <>
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
                        {paginated.map((s, idx) => {
                          const isEditing = editingId === s.id;
                          const isSaved   = savedId   === s.id;
                          const g = gInfo(s.gender);
                          return (
                            <tr key={s.id} className="tsp-tr" style={{ background: isSaved ? "#f0fdf4" : isEditing ? "#fffbf5" : undefined }}>

                              {/* # */}
                              <td className="tsp-td" style={{ textAlign:"center", fontSize:13, fontWeight:900, color:"#94a3b8" }}>
                                {(page - 1) * PAGE_SIZE + idx + 1}
                              </td>

                              {/* Student — name only */}
                              <td className="tsp-td">
                                <span style={{ fontSize:13, fontWeight:900, color:"#1f2d36" }}>{s.full_name}</span>
                              </td>

                              {/* Guardian */}
                              <td className="tsp-td hide-sm">
                                {s.guardian_name ? (
                                  <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>
                                    {s.guardian_name}{" "}
                                    {s.guardian_relation && <span style={{ fontSize:10, color:"#94a3b8" }}>({s.guardian_relation})</span>}
                                  </span>
                                ) : <span style={{ color:"#d4dde2" }}>—</span>}
                              </td>

                              {/* Gender */}
                              <td className="tsp-td hide-sm">
                                <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:800, background:g.bg, color:g.color, border:`1px solid ${g.border}40` }}>
                                  {g.label}
                                </span>
                              </td>

                              {/* Roll No. */}
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
                                      <i className="fa-solid fa-phone" style={{ fontSize:10, color:"#94a3b8" }} />{s.guardian_phone}
                                    </span>
                                  : <span style={{ color:"#d4dde2" }}>—</span>}
                              </td>

                              {/* Actions */}
                              <td className="tsp-td" style={{ textAlign:"right" }}>
                                {isEditing ? (
                                  <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                                    <button onClick={() => saveEdit(s.id)} disabled={saving}
                                      style={{ padding:"6px 13px", borderRadius:7, border:"none", background:"#12805c", color:"#fff", fontSize:11, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                                      {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />} Save
                                    </button>
                                    <button onClick={cancelEdit}
                                      style={{ width:30, height:30, borderRadius:7, border:"1px solid #dce5e9", background:"#fff", color:"#475569", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                      <i className="fa-solid fa-xmark" />
                                    </button>
                                  </div>
                                ) : isSaved ? (
                                  <span style={{ fontSize:11, fontWeight:800, color:"#12805c", display:"flex", alignItems:"center", gap:4, justifyContent:"flex-end" }}>
                                    <i className="fa-solid fa-circle-check" /> Saved
                                  </span>
                                ) : (
                                  <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                                    <button onClick={() => startEdit(s)}
                                      style={{ padding:"6px 12px", borderRadius:7, border:"1.5px solid #FF9B5150", background:"#fff7ed", color:"#c46a14", fontSize:11, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                                      <i className="fa-solid fa-pen" /> Edit
                                    </button>
                                    <button onClick={() => router.push(`/teacher/students/${s.student_id}`)}
                                      style={{ padding:"6px 12px", borderRadius:7, border:"1.5px solid #1a73e840", background:"#e8f0fe", color:"#1a73e8", fontSize:11, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                                      <i className="fa-solid fa-eye" /> View
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Pagination ── */}
                  {totalPages > 1 && (
                    <div style={{ padding:"12px 18px", borderTop:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"#6a7882" }}>
                        Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length} students
                      </span>
                      <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                        <button className="pg-btn" onClick={() => setPage(1)}          disabled={page===1}><i className="fa-solid fa-angles-left"  style={{ fontSize:10 }} /></button>
                        <button className="pg-btn" onClick={() => setPage(p => p-1)}   disabled={page===1}><i className="fa-solid fa-angle-left"   style={{ fontSize:10 }} /></button>
                        {Array.from({ length:totalPages }, (_,i) => i+1)
                          .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=1)
                          .reduce<(number|string)[]>((acc,p,i,arr) => {
                            if (i>0 && (p as number)-(arr[i-1] as number)>1) acc.push("…");
                            acc.push(p); return acc;
                          }, [])
                          .map((p,i) => p==="…"
                            ? <span key={`e${i}`} style={{ width:32, textAlign:"center", fontSize:13, color:"#94a3b8" }}>…</span>
                            : <button key={p} className={`pg-btn${p===page?" pg-active":""}`} onClick={() => setPage(p as number)}>{p}</button>
                          )}
                        <button className="pg-btn" onClick={() => setPage(p => p+1)}   disabled={page===totalPages}><i className="fa-solid fa-angle-right"  style={{ fontSize:10 }} /></button>
                        <button className="pg-btn" onClick={() => setPage(totalPages)} disabled={page===totalPages}><i className="fa-solid fa-angles-right" style={{ fontSize:10 }} /></button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Info note */}
            <div style={{ padding:"11px 16px", borderRadius:10, background:"#fff7ed", border:"1px solid #fed7aa", borderLeft:"4px solid #FF9B51", display:"flex", gap:9, alignItems:"flex-start" }}>
              <i className="fa-solid fa-circle-info" style={{ color:"#c2410c", fontSize:13, flexShrink:0, marginTop:1 }} />
              <span style={{ fontSize:12, fontWeight:700, color:"#92400e" }}>
                You can edit <strong>Roll Number</strong> and <strong>Remarks</strong>. All other student details can only be changed by the school admin.
              </span>
            </div>

          </>)}
        </div>
      </div>
    </>
  );
}
