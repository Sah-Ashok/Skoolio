"use client";

import { useState, useMemo, useCallback } from "react";
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
  id: number;
  student_id: number;
  full_name: string;
  admission_number: string;
  photo: string | null;
  gender: string;
  roll_number: string | null;
  remarks: string | null;
  section_id: number;
  section_name: string;
  class_name: string;
  date_of_birth?: string;
  phone?: string;
  registration_number?: string | null;
  symbol_number?: string | null;
}

const avatar = (name: string) => name?.charAt(0)?.toUpperCase() ?? "?";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function TeacherStudentsPage() {
  const dispatch = useAppDispatch();
  const { activeYear } = useAcademicYear();
  const academicYearId = activeYear?.id ?? null;

  const { data: sectionsRaw, loading: sectionsLoading } =
    useApi<Section[]>("/teachers/me/sections", []);
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
      (s.admission_number ?? "").toLowerCase().includes(q) ||
      (s.roll_number ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // ── Inline edit ───────────────────────────────────────────────────────────
  const [editingId,   setEditingId  ] = useState<number | null>(null);
  const [editRoll,    setEditRoll   ] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [saving,      setSaving     ] = useState(false);
  const [savedId,     setSavedId    ] = useState<number | null>(null);

  // expanded student detail panel
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
        body: JSON.stringify({
          roll_number: editRoll.trim() || null,
          remarks:     editRemarks.trim() || null,
        }),
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
  const sectionLabel   = currentSection
    ? `${currentSection.class_name ? currentSection.class_name + " — " : ""}${currentSection.name}`
    : "";

  return (
    <>
      <style>{`
        .tsp { min-height:100vh; background:#eef2f3; }
        .tsp-main { padding:20px; max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        .tsp-card { background:#fff; border-radius:14px; border:1px solid #dce5e9; overflow:hidden; box-shadow:0 2px 8px rgba(31,45,54,.05); }
        .tsp-th { padding:10px 16px; text-align:left; font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; white-space:nowrap; border-bottom:2px solid #eef2f3; background:#f7fafb; }
        .tsp-td { padding:13px 16px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
        .tsp-tr:hover td { background:#fafcfc; }
        .tsp-tr.editing td { background:#fff7ed; }
        .tsp-tr.saved td { background:#f0fdf4; }
        .tsp-input { width:100%; padding:6px 10px; border-radius:7px; border:1.5px solid #FF9B51; font-size:12px; font-weight:700; outline:none; background:#fff; }
        @media(max-width:680px){ .tsp-hide-mobile { display:none; } }
      `}</style>

      <div className="tsp">
        <Topbar title="My Students" subtitle="Students enrolled in your coordinated sections" />

        <div className="tsp-main">
          {sectionsLoading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={28} color="#FF9B51" /></div>
          ) : sections.length === 0 ? (
            <div className="tsp-card" style={{ padding: "3rem", textAlign: "center" }}>
              <i className="fa-solid fa-chalkboard-user" style={{ fontSize: 36, color: "#d4dde2", display: "block", marginBottom: 14 }} />
              <p style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", margin: "0 0 6px" }}>No sections assigned</p>
              <p style={{ fontSize: 13, color: "#6a7882", margin: 0 }}>You are not set as coordinator of any section. Ask your admin to assign you.</p>
            </div>
          ) : (
            <>
              {/* ── Section tabs ── */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {sections.map(sec => {
                  const active = sec.id === sectionId;
                  const label  = sec.class_name ? `${sec.class_name} — ${sec.name}` : sec.name;
                  return (
                    <button key={sec.id}
                      onClick={() => { setSelectedSectionId(sec.id); setSearch(""); setEditingId(null); setExpandedId(null); }}
                      style={{ padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 900, fontSize: 13, fontFamily: "inherit", transition: "all .15s",
                        border:      active ? "2px solid #FF9B51" : "1.5px solid #dce5e9",
                        background:  active ? "#FF9B51" : "#fff",
                        color:       active ? "#fff" : "#475569",
                        boxShadow:   active ? "0 4px 12px rgba(255,155,81,.3)" : "none",
                      }}>
                      <i className="fa-solid fa-chalkboard" style={{ marginRight: 7, fontSize: 12 }} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* ── Stats ── */}
              {!studentsLoading && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 12 }}>
                  {[
                    { icon: "fa-users",          label: "Total",          val: students.length,                               color: "#1e293b", bg: "#f7fafb",  border: "#e2e8f0" },
                    { icon: "fa-mars",            label: "Male",           val: students.filter(s => s.gender === "male").length,   color: "#1a73e8", bg: "#e8f0fe",  border: "#bfdbfe" },
                    { icon: "fa-venus",           label: "Female",         val: students.filter(s => s.gender === "female").length, color: "#c2185b", bg: "#fce4ec",  border: "#fbcfe8" },
                    { icon: "fa-list-ol",         label: "Has Roll No.",   val: students.filter(s => !!s.roll_number).length,      color: "#12805c", bg: "#e2f6ee",  border: "#a7f3d0" },
                    { icon: "fa-circle-question", label: "No Roll No.",    val: students.filter(s => !s.roll_number).length,       color: "#c46a14", bg: "#fff1df",  border: "#fde68a" },
                  ].map(st => (
                    <div key={st.label} style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 11, padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <i className={`fa-solid ${st.icon}`} style={{ color: st.color, fontSize: 13 }} />
                        <span style={{ fontSize: 10, fontWeight: 900, color: st.color, textTransform: "uppercase", letterSpacing: "0.5px" }}>{st.label}</span>
                      </div>
                      <strong style={{ fontSize: 22, fontWeight: 900, color: st.color }}>{st.val}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Table card ── */}
              <div className="tsp-card">
                {/* Card head */}
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #eef2f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>{sectionLabel}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: "#6a7882" }}>Click Edit to update roll number · Click a row to expand student details</p>
                  </div>
                  <div style={{ position: "relative" }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#94a3b8" }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search name / admission / roll…"
                      style={{ paddingLeft: 30, paddingRight: 10, height: 36, borderRadius: 8, border: "1px solid #d4dde2", fontSize: 12, fontWeight: 700, outline: "none", width: 230, background: "#f8fafc" }} />
                  </div>
                </div>

                {/* Table */}
                {studentsLoading ? (
                  <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={26} color="#FF9B51" /></div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: "3rem", textAlign: "center" }}>
                    <i className="fa-solid fa-user-slash" style={{ fontSize: 30, color: "#d4dde2", display: "block", marginBottom: 10 }} />
                    <p style={{ fontSize: 13, color: "#6a7882", margin: 0 }}>
                      {search ? "No students match your search." : "No students enrolled in this section."}
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th className="tsp-th" style={{ width: 40 }}>#</th>
                          <th className="tsp-th">Student</th>
                          <th className="tsp-th tsp-hide-mobile">Adm. No</th>
                          <th className="tsp-th tsp-hide-mobile">Gender</th>
                          <th className="tsp-th">Roll No.</th>
                          <th className="tsp-th tsp-hide-mobile">Remarks</th>
                          <th className="tsp-th" style={{ textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s, idx) => {
                          const isEditing  = editingId  === s.id;
                          const isSaved    = savedId    === s.id;
                          const isExpanded = expandedId === s.id;
                          const gColor = s.gender === "male" ? "#1a73e8" : s.gender === "female" ? "#c2185b" : "#7c3aed";
                          const gBg    = s.gender === "male" ? "#e8f0fe" : s.gender === "female" ? "#fce4ec" : "#f3eeff";

                          return [
                            // ── Main row ──
                            <tr key={`row-${s.id}`}
                              className={`tsp-tr${isEditing ? " editing" : ""}${isSaved ? " saved" : ""}`}
                            >
                              {/* # */}
                              <td className="tsp-td" style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", width: 40 }}>{idx + 1}</td>

                              {/* Student name */}
                              <td className="tsp-td">
                                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                                  onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                                  <div style={{ width: 36, height: 36, borderRadius: 9, background: gBg, color: gColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, flexShrink: 0, border: `1px solid ${gColor}30` }}>
                                    {s.photo
                                      ? <img src={s.photo} alt={s.full_name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 9 }} />
                                      : avatar(s.full_name)
                                    }
                                  </div>
                                  <div>
                                    <strong style={{ display: "block", fontSize: 13, fontWeight: 900, color: "#1f2d36" }}>{s.full_name}</strong>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8" }}>
                                      <i className={`fa-solid fa-chevron-${isExpanded ? "up" : "down"}`} style={{ fontSize: 9, marginRight: 4 }} />
                                      {isExpanded ? "Hide details" : "View details"}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Adm no */}
                              <td className="tsp-td tsp-hide-mobile" style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#6a7882" }}>
                                {s.admission_number}
                              </td>

                              {/* Gender */}
                              <td className="tsp-td tsp-hide-mobile">
                                <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: gBg, color: gColor, textTransform: "capitalize" }}>
                                  {s.gender || "—"}
                                </span>
                              </td>

                              {/* Roll number */}
                              <td className="tsp-td">
                                {isEditing ? (
                                  <input className="tsp-input" value={editRoll}
                                    onChange={e => setEditRoll(e.target.value)}
                                    placeholder="e.g. 1" autoFocus style={{ width: 80 }} />
                                ) : (
                                  <span style={{ fontSize: 14, fontWeight: 900, color: s.roll_number ? "#1f2d36" : "#d4dde2" }}>
                                    {s.roll_number || "—"}
                                  </span>
                                )}
                              </td>

                              {/* Remarks */}
                              <td className="tsp-td tsp-hide-mobile">
                                {isEditing ? (
                                  <input className="tsp-input" value={editRemarks}
                                    onChange={e => setEditRemarks(e.target.value)}
                                    placeholder="Optional" />
                                ) : (
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6a7882" }}>{s.remarks || "—"}</span>
                                )}
                              </td>

                              {/* Action */}
                              <td className="tsp-td" style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                  {isEditing ? (
                                    <>
                                      <button onClick={() => saveEdit(s.id)} disabled={saving}
                                        style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#FF9B51", color: "#fff", fontSize: 12, fontWeight: 900, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                                        {saving ? <Spinner size={12} color="#fff" /> : <i className="fa-solid fa-check" />} Save
                                      </button>
                                      <button onClick={cancelEdit}
                                        style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #d4dde2", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                        <i className="fa-solid fa-xmark" />
                                      </button>
                                    </>
                                  ) : isSaved ? (
                                    <span style={{ fontSize: 12, fontWeight: 800, color: "#12805c", display: "flex", alignItems: "center", gap: 5 }}>
                                      <i className="fa-solid fa-circle-check" /> Saved
                                    </span>
                                  ) : (
                                    <button onClick={() => startEdit(s)}
                                      style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #dce5e9", background: "#f7fafb", color: "#1e293b", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                                      <i className="fa-solid fa-pen" /> Edit
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>,

                            // ── Expanded detail row ──
                            ...(isExpanded ? [
                              <tr key={`detail-${s.id}`}>
                                <td colSpan={7} style={{ padding: "0 16px 14px", background: "#f7fafb", borderBottom: "1px solid #eef2f3" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, padding: "14px 0 2px" }}>
                                    {[
                                      { icon: "fa-id-card",          label: "Admission No.",       val: s.admission_number             },
                                      { icon: "fa-cake-candles",     label: "Date of Birth",       val: fmtDate(s.date_of_birth)        },
                                      { icon: "fa-venus-mars",       label: "Gender",              val: s.gender || "—"                 },
                                      { icon: "fa-phone",            label: "Phone",               val: s.phone || "—"                  },
                                      { icon: "fa-list-ol",          label: "Roll Number",         val: s.roll_number || "Not assigned" },
                                      { icon: "fa-file-lines",       label: "Registration No.",    val: s.registration_number || "—"   },
                                      { icon: "fa-hashtag",          label: "Symbol Number",       val: s.symbol_number || "—"          },
                                    ].map(f => (
                                      <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                          <i className={`fa-solid ${f.icon}`} style={{ fontSize: 11, color: "#94a3b8" }} />
                                        </div>
                                        <div>
                                          <span style={{ display: "block", fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{f.label}</span>
                                          <span style={{ fontSize: 12, fontWeight: 800, color: f.val === "Not assigned" || f.val === "—" ? "#d4dde2" : "#1e293b" }}>{f.val}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ] : []),
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Info note */}
              <div style={{ padding: "11px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 9, alignItems: "flex-start" }}>
                <i className="fa-solid fa-circle-info" style={{ color: "#c2410c", fontSize: 13, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                  You can edit <strong>Roll Number</strong> and <strong>Remarks</strong>. All other student details (name, DOB, contact) can only be changed by the school admin.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
