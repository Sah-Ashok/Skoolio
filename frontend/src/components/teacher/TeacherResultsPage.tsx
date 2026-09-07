"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApi, useMutation } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { apiRequest } from "@/lib/api";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

export default function TeacherResultsPage() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { activeYear } = useAcademicYear();
  const { data: exams }      = useApi<any[]>(
    activeYear?.id ? `/exams?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );
  const { data: mySubjectClasses, loading: mySubjectsLoading } = useApi<any[]>(
    activeYear?.id ? "/classes/me/subject-classes" : "",
    [activeYear?.id]
  );
  const { data: coordinatedSections, loading: coordinatedLoading } = useApi<any[]>(
    "/classes/me/coordinated-sections"
  );

  const myAssignments = useMemo(() => {
    if (!mySubjectClasses || !activeYear?.id) return [];
    return mySubjectClasses.filter((a: any) => a.academic_year_id === activeYear.id);
  }, [mySubjectClasses, activeYear?.id]);

  const mySubjectIds = useMemo(
    () => new Set(myAssignments.map((a: any) => a.subject_id)),
    [myAssignments]
  );

  const hasCoordinatedSections = Boolean(coordinatedSections && coordinatedSections.length > 0);

  // Tab View Mode
  const [viewMode, setViewMode] = useState<"entry" | "register">("entry");

  // Sync tab with URL search params
  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "register") {
      setViewMode("register");
    } else if (tab === "entry" || !tab) {
      setViewMode("entry");
    }
  }, [searchParams]);

  const [examId,             setExamId            ] = useState("");
  const [scheduleId,         setScheduleId        ] = useState("");
  const [schedules,          setSchedules         ] = useState<any[]>([]);
  const [schedulesLoading,   setSchedulesLoading  ] = useState(false);
  const [enrollments,        setEnrollments       ] = useState<any[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [results,            setResults           ] = useState<any[]>([]);
  const [marksMap,           setMarksMap          ] = useState<Record<string, { marks_obtained: string; is_absent: boolean; remarks: string }>>({});

  // ── Tab 2: Class Register State & Filters ──
  const [registerExamId,        setRegisterExamId       ] = useState("");
  const [registerSectionId,     setRegisterSectionId    ] = useState("");
  const [registerSearch,        setRegisterSearch       ] = useState("");
  const [registerStatusFilter,  setRegisterStatusFilter ] = useState<"all" | "passed" | "failed">("all");
  const [registerSortBy,        setRegisterSortBy       ] = useState<"rank" | "roll" | "name" | "percentage">("rank");
  const [registerViewMode,      setRegisterViewMode     ] = useState<"table" | "cards">("table");

  // ── Tab 1: Entry Filter ──
  const [entrySearch,           setEntrySearch          ] = useState("");

  const { execute: bulkSaveResults, loading: saving } = useMutation("/exams/results/bulk", "POST");

  // Auto-select exam
  useEffect(() => {
    if (exams?.length) {
      if (!examId) setExamId(exams[0].id.toString());
      if (!registerExamId) setRegisterExamId(exams[0].id.toString());
    }
  }, [exams, examId, registerExamId]);

  // Auto-select first coordinated section
  useEffect(() => {
    if (coordinatedSections && coordinatedSections.length > 0 && !registerSectionId) {
      setRegisterSectionId(coordinatedSections[0].id.toString());
    }
  }, [coordinatedSections, registerSectionId]);

  useEffect(() => {
    if (!examId) { setSchedules([]); return; }
    const load = async () => {
      setSchedulesLoading(true);
      try {
        const res      = await apiRequest<{ data: any[] }>(`/exams/${examId}/schedules`);
        const filtered = (res.data || []).filter(
          (sch: any) => mySubjectIds.size === 0 || mySubjectIds.has(sch.subject_id)
        );
        setSchedules(filtered);
        setScheduleId(filtered.length > 0 ? filtered[0].id.toString() : "");
      } catch { setSchedules([]); }
      finally  { setSchedulesLoading(false); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, mySubjectIds]);

  const selectedSchedule = schedules.find(s => s.id.toString() === scheduleId);

  useEffect(() => {
    if (!selectedSchedule || !activeYear?.id) { setEnrollments([]); setResults([]); return; }
    const load = async () => {
      setEnrollmentsLoading(true);
      try {
        const [enrollRes, resultsRes] = await Promise.all([
          apiRequest<{ data: any[] }>(`/students/enrollments?academic_year_id=${activeYear.id}&class_id=${selectedSchedule.class_id}`),
          apiRequest<{ data: any[] }>(`/exams/${examId}/class/${selectedSchedule.class_id}/results`),
        ]);
        setEnrollments(enrollRes.data || []);
        setResults(resultsRes.data || []);
      } catch { setEnrollments([]); setResults([]); }
      finally  { setEnrollmentsLoading(false); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchedule?.id, activeYear?.id]);

  const existingByStudent = useMemo(() => {
    if (!selectedSchedule) return new Map<number, any>();
    const m = new Map<number, any>();
    results.filter(r => r.subject_id === selectedSchedule.subject_id).forEach(r => m.set(r.student_id, r));
    return m;
  }, [results, selectedSchedule]);

  useEffect(() => {
    if (!selectedSchedule) return;
    const init: Record<string, any> = {};
    enrollments.forEach(en => {
      const ex = existingByStudent.get(en.student_id);
      init[en.student_id] = {
        marks_obtained: ex?.marks_obtained != null ? ex.marks_obtained.toString() : "",
        is_absent:      ex ? ex.is_absent : false,
        remarks:        ex?.remarks || "",
      };
    });
    setMarksMap(init);
  }, [enrollments, existingByStudent, selectedSchedule]);

  const isPublished = results.some(
    r => r.status === "published" && r.subject_id === selectedSchedule?.subject_id
  );

  const updateMark = (studentId: number, field: string, value: string | boolean) =>
    setMarksMap(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));

  const handleSave = async () => {
    if (!selectedSchedule) return;
    try {
      const resultsToSave = enrollments.map(en => {
        const entry = marksMap[en.student_id];
        if (!entry || (!entry.is_absent && entry.marks_obtained === "")) return null;
        return {
          student_id:     en.student_id,
          enrollment_id:  en.id,
          marks_obtained: entry.is_absent ? null : parseFloat(entry.marks_obtained),
          is_absent:      entry.is_absent,
          remarks:        entry.remarks || null,
        };
      }).filter(Boolean);

      if (!resultsToSave.length) {
        dispatch(showToast({ type: "warning", title: "No Data", message: "No marks entered to save." }));
        return;
      }

      await bulkSaveResults({
        exam_id:     parseInt(examId),
        schedule_id: selectedSchedule.id,
        subject_id:  selectedSchedule.subject_id,
        results:     resultsToSave,
      });

      dispatch(showToast({ type: "success", title: "Saved", message: "Marks saved successfully." }));

      // Refresh results list so status reflects saved marks
      const resultsRes = await apiRequest<{ data: any[] }>(`/exams/${examId}/class/${selectedSchedule.class_id}/results`);
      setResults(resultsRes.data || []);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save marks" }));
    }
  };

  // ── Tab 2: Class Register Query ──
  const selectedCoordinated = coordinatedSections?.find(s => s.id.toString() === registerSectionId);
  const { data: registerData, loading: registerLoading } = useApi<any>(
    registerExamId && selectedCoordinated
      ? `/exams/${registerExamId}/class/${selectedCoordinated.class_id}/register?section_id=${selectedCoordinated.id}`
      : ""
  );

  const enteredCount = Object.values(marksMap).filter(m => m.is_absent || m.marks_obtained !== "").length;
  const absentCount  = Object.values(marksMap).filter(m => m.is_absent).length;
  const passCount    = selectedSchedule
    ? Object.values(marksMap).filter(m => !m.is_absent && m.marks_obtained !== "" && parseFloat(m.marks_obtained) >= selectedSchedule.pass_marks).length
    : 0;

  // Filtered enrollments for Tab 1
  const filteredEnrollments = useMemo(() => {
    if (!enrollments) return [];
    let list = [...enrollments];
    if (entrySearch.trim()) {
      const q = entrySearch.trim().toLowerCase();
      list = list.filter((en: any) =>
        (en.full_name ?? "").toLowerCase().includes(q) ||
        (en.roll_number ?? "").toString().toLowerCase().includes(q) ||
        (en.admission_number ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrollments, entrySearch]);

  // Filtered & sorted students for Tab 2
  const filteredRegisterStudents = useMemo(() => {
    if (!registerData?.students) return [];
    let list = [...registerData.students];

    if (registerSearch.trim()) {
      const q = registerSearch.trim().toLowerCase();
      list = list.filter((s: any) =>
        (s.full_name ?? "").toLowerCase().includes(q) ||
        (s.roll_number ?? "").toString().toLowerCase().includes(q) ||
        (s.admission_number ?? "").toLowerCase().includes(q)
      );
    }

    if (registerStatusFilter === "passed") {
      list = list.filter((s: any) => s.status === "passed");
    } else if (registerStatusFilter === "failed") {
      list = list.filter((s: any) => s.status === "failed");
    }

    if (registerSortBy === "roll") {
      list.sort((a: any, b: any) => (Number(a.roll_number) || 9999) - (Number(b.roll_number) || 9999));
    } else if (registerSortBy === "name") {
      list.sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));
    } else if (registerSortBy === "percentage") {
      list.sort((a: any, b: any) => (Number(b.overall_percentage) || 0) - (Number(a.overall_percentage) || 0));
    } else if (registerSortBy === "rank") {
      list.sort((a: any, b: any) => (Number(a.rank) || 9999) - (Number(b.rank) || 9999));
    }

    return list;
  }, [registerData?.students, registerSearch, registerStatusFilter, registerSortBy]);

  if (!mySubjectsLoading && !coordinatedLoading && activeYear && exams && exams.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <main style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26, color: "#94a3b8" }}>
              <i className="fa-solid fa-pen-to-square" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: "#0f172a" }}>No exams yet this year</h2>
            <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, lineHeight: 1.6 }}>
              No exams have been scheduled for <strong>{activeYear?.year_name}</strong> yet.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!mySubjectsLoading && !coordinatedLoading && activeYear && myAssignments.length === 0 && !hasCoordinatedSections) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <main style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26, color: "#c46a14" }}>
              <i className="fa-solid fa-book-open" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>No assignments found</h2>
            <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, lineHeight: 1.6 }}>
              You are not assigned to teach any subjects or coordinate any classes this academic year.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-register, .printable-register * { visibility: visible; }
          .printable-register { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }

        * {
          font-family: 'Nunito', sans-serif;
          box-sizing: border-box;
        }

        .results-main-wrap {
          padding: 20px 24px;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .results-header-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .page-main-title {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.3px;
        }
        .page-sub-title {
          margin: 3px 0 0;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
        }
        .results-tabs-wrapper {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .results-tab-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 38px;
          padding: 0 16px;
          border-radius: 9px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          color: #64748b;
          transition: all 0.18s ease;
        }
        .results-tab-pill.active {
          border-color: #ff9148;
          background: #fff7ed;
          color: #ea580c;
          box-shadow: 0 1px 4px rgba(255,145,72,0.15);
        }
        .tab-badge {
          padding: 2px 7px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 900;
          background: #f1f5f9;
          color: #475569;
        }
        .results-tab-pill.active .tab-badge {
          background: #fed7aa;
          color: #9a3412;
        }

        /* Entry View */
        .entry-grid-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .entry-meta-bar {
          display: flex;
          gap: 20px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #f1f5f9;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
        }
        .entry-save-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 20px;
          border-radius: 9px;
          border: none;
          font-weight: 800;
          font-size: 13.5px;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        /* Register View: Filter Bar */
        .register-filter-card {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(15,23,42,0.04);
        }
        .filter-controls-row {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .filter-select-group {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border: 1.5px solid #e2e8f0;
          border-radius: 9px;
          background: #f8fafc;
          flex: 1 1 200px;
          height: 42px;
        }
        .filter-select-inner {
          display: flex;
          flex-direction: column;
          width: 100%;
          min-width: 0;
        }
        .filter-select-label {
          font-size: 9.5px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          line-height: 1;
        }
        .filter-select-input {
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          outline: none;
          cursor: pointer;
          padding: 2px 0 0;
          width: 100%;
        }
        .filter-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border: 1.5px solid #e2e8f0;
          border-radius: 9px;
          background: #f8fafc;
          flex: 1 1 220px;
          height: 42px;
        }
        .filter-search-input {
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          outline: none;
          width: 100%;
          padding: 2px 0 0;
        }

        .filter-sub-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-top: 1px solid #f1f5f9;
          padding-top: 10px;
          flex-wrap: wrap;
        }
        .status-pill-list {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 11px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .status-pill.active {
          border: 1.5px solid #ff9148;
          background: #fff7ed;
          color: #ea580c;
        }
        .status-pill .pill-badge {
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 10.5px;
          font-weight: 900;
          background: #e2e8f0;
          color: #475569;
        }
        .status-pill.active .pill-badge {
          background: #fed7aa;
          color: #9a3412;
        }
        .sort-select-box {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
        }
        .sort-select-input {
          height: 32px;
          padding: 0 10px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 12px;
          font-weight: 700;
          background: #fff;
          outline: none;
          cursor: pointer;
          color: #0f172a;
        }

        /* KPIs */
        .results-kpi-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .kpi-card {
          background: #ffffff;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .kpi-topper-cell {
          background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
          padding: 14px 16px;
          border-radius: 12px;
          border: 1.5px solid #facc15;
        }

        .desktop-table-container {
          display: block;
        }
        .mobile-card-list {
          display: none;
        }
        .mobile-scroll-cue {
          display: none;
        }

        @media (max-width: 768px) {
          .results-main-wrap {
            padding: 10px 12px;
            gap: 12px;
          }
          .results-header-box {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .page-main-title {
            font-size: 19px;
          }
          .page-sub-title {
            font-size: 12px;
          }
          .results-tabs-wrapper {
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
            gap: 6px;
          }
          .results-tab-pill {
            height: 38px;
            padding: 0 6px;
            font-size: 12px;
            gap: 6px;
          }
          .register-filter-card {
            padding: 10px 12px;
            gap: 10px;
            border-radius: 12px;
          }
          .filter-controls-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .filter-select-group {
            flex: unset;
            width: 100%;
            min-width: 0;
            height: 40px;
            padding: 4px 8px;
          }
          .filter-select-label {
            font-size: 9px;
          }
          .filter-select-input {
            font-size: 12px;
          }
          .filter-search-box {
            grid-column: 1 / -1;
            width: 100%;
            height: 38px;
            padding: 4px 10px;
          }
          .filter-sub-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            padding-top: 8px;
          }
          .status-pill-list {
            overflow-x: auto;
            padding-bottom: 2px;
            -webkit-overflow-scrolling: touch;
            width: 100%;
          }
          .status-pill {
            padding: 4px 9px;
            font-size: 11px;
            flex-shrink: 0;
          }
          .sort-select-box {
            justify-content: space-between;
            width: 100%;
          }
          .sort-select-input {
            height: 30px;
            font-size: 11.5px;
            flex: 1;
          }
          .results-kpi-container {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .kpi-card {
            padding: 10px 12px;
          }
          .kpi-topper-cell {
            grid-column: 1 / -1;
            padding: 10px 12px;
          }
          .desktop-table-container {
            display: none;
          }
          .mobile-card-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .entry-grid-2col {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .entry-meta-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .entry-save-btn {
            width: 100%;
            justify-content: center;
            padding: 11px;
          }
          .mobile-scroll-cue {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 12px;
            background: #fff7ed;
            color: #ea580c;
            font-size: 11px;
            font-weight: 800;
            border-bottom: 1px solid #ffedd5;
          }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <main className="results-main-wrap">

          {/* ── Page Header & Tabs ── */}
          <div className="no-print results-header-box">
            <div>
              <h1 className="page-main-title">Exam Results & Tabulation</h1>
              <p className="page-sub-title">
                {viewMode === "entry"
                  ? "Record and update student marks for your assigned subjects."
                  : "View complete class results, student progress, and rankings for your section."}
              </p>
            </div>

            {/* Segmented Switcher */}
            {hasCoordinatedSections && (
              <div className="results-tabs-wrapper">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("entry");
                    router.replace("/teacher/results", { scroll: false });
                  }}
                  className={`results-tab-pill ${viewMode === "entry" ? "active" : ""}`}
                >
                  <i
                    className="fa-solid fa-pen-to-square"
                    style={{ color: viewMode === "entry" ? "#ff9148" : "#94a3b8" }}
                  />
                  <span>Enter Marks</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("register");
                    router.replace("/teacher/results?tab=register", { scroll: false });
                  }}
                  className={`results-tab-pill ${viewMode === "register" ? "active" : ""}`}
                >
                  <i
                    className="fa-solid fa-table-list"
                    style={{ color: viewMode === "register" ? "#ff9148" : "#94a3b8" }}
                  />
                  <span>Class Register</span>
                  <span className="tab-badge">
                    {coordinatedSections?.length ?? 0}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════════════════
              VIEW MODE 1: SUBJECT MARKS ENTRY
             ══════════════════════════════════════════════════════════════════════════════ */}
          {viewMode === "entry" && (
            <>
              {/* Teaching assignment banner */}
              {myAssignments.length > 0 && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12.5, fontWeight: 700, color: "#15803d", display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: 15 }} />
                  <span>
                    You teach <strong>{myAssignments.length}</strong> subject{myAssignments.length !== 1 ? "s" : ""} in {activeYear?.year_name}:&nbsp;
                    {myAssignments.map((a: any, i: number) => (
                      <span key={`${a.subject_id}_${a.class_id}`}>
                        {i > 0 && ", "}
                        <strong>{a.subject_name}</strong> ({a.class_name})
                      </span>
                    ))}
                  </span>
                </div>
              )}

              {/* Selector Card */}
              <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "14px 16px", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                <div className="entry-grid-2col">
                  {/* Exam selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 900, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                      Exam
                    </label>
                    <select
                      value={examId}
                      onChange={e => setExamId(e.target.value)}
                      style={{ height: 40, padding: "0 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 700, background: "#fff", outline: "none", cursor: "pointer", width: "100%" }}
                    >
                      {(exams ?? []).map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subject / Class selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 900, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                      Your Assigned Subject / Class
                    </label>
                    <select
                      value={scheduleId}
                      onChange={e => setScheduleId(e.target.value)}
                      disabled={schedules.length === 0}
                      style={{ height: 40, padding: "0 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 700, background: "#fff", outline: "none", cursor: schedules.length === 0 ? "not-allowed" : "pointer", width: "100%" }}
                    >
                      {schedules.length === 0
                        ? <option>No subjects scheduled for you in this exam</option>
                        : schedules.map(sch => (
                            <option key={sch.id} value={sch.id}>
                              {sch.subject_name ?? `Subject ${sch.subject_id}`} — {sch.class_name ?? `Class ${sch.class_id}`}
                            </option>
                          ))
                      }
                    </select>
                  </div>
                </div>

                {/* Meta Strip */}
                {selectedSchedule && (
                  <div className="entry-meta-bar">
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {[
                        { label: "Subject",    value: selectedSchedule.subject_name },
                        { label: "Class",      value: selectedSchedule.class_name },
                        { label: "Max Marks",  value: selectedSchedule.max_marks },
                        { label: "Pass Marks", value: selectedSchedule.pass_marks },
                        { label: "Exam Date",  value: selectedSchedule.exam_date ?? "—" },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{item.label}</span>
                          <strong style={{ fontSize: 12.5, color: "#0f172a" }}>{item.value}</strong>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving || !selectedSchedule || isPublished}
                      className="entry-save-btn"
                      style={{
                        background: !selectedSchedule || isPublished ? "#e2e8f0" : "#ff9148",
                        color:      !selectedSchedule || isPublished ? "#94a3b8" : "#ffffff",
                        cursor: saving || !selectedSchedule || isPublished ? "not-allowed" : "pointer",
                        boxShadow: !selectedSchedule || isPublished ? "none" : "0 2px 8px rgba(255,145,72,0.25)",
                      }}
                    >
                      {saving ? <Spinner size={14} color="#fff" /> : <i className="fa-solid fa-floppy-disk" />}
                      {saving ? "Saving…" : "Save Marks"}
                    </button>
                  </div>
                )}
              </div>

              {/* Published Lock Notice */}
              {isPublished && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fefce8", border: "1.5px solid #fef08a", color: "#854d0e", fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="fa-solid fa-lock" style={{ fontSize: 14 }} />
                  <span>Results for this subject have been published by the admin and are locked. Contact your admin to make changes.</span>
                </div>
              )}

              {/* Students marks table / cards */}
              <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", width: "100%", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: "#0f172a" }}>
                      Student Marks ({enrollments.length} Enrolled)
                    </h3>
                    {/* Live Search */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", flex: "1 1 160px", maxWidth: 240 }}>
                      <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 11 }} />
                      <input
                        type="text"
                        value={entrySearch}
                        onChange={e => setEntrySearch(e.target.value)}
                        placeholder="Search student or roll..."
                        style={{ border: "none", background: "transparent", fontSize: 12, fontWeight: 600, color: "#0f172a", outline: "none", width: "100%" }}
                      />
                      {entrySearch && (
                        <button type="button" onClick={() => setEntrySearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}>
                          <i className="fa-solid fa-xmark" style={{ fontSize: 11 }} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, fontSize: 11.5, fontWeight: 700, color: "#64748b", alignItems: "center", flexWrap: "wrap" }}>
                    <span>Entered: <strong>{enteredCount}</strong>/{enrollments.length}</span>
                    <span>Passed: <strong style={{ color: "#16a34a" }}>{passCount}</strong></span>
                    <span>Absent: <strong style={{ color: "#b45309" }}>{absentCount}</strong></span>
                  </div>
                </div>

                {/* Desktop table */}
                <div className="desktop-table-container" style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>
                        <th style={{ padding: "11px 16px", textAlign: "left" }}>Roll</th>
                        <th style={{ padding: "11px 16px", textAlign: "left" }}>Student Name</th>
                        <th style={{ padding: "11px 16px", textAlign: "left", width: 140 }}>Marks Obtained</th>
                        <th style={{ padding: "11px 16px", textAlign: "center", width: 90 }}>Absent</th>
                        <th style={{ padding: "11px 16px", textAlign: "left" }}>Remarks</th>
                        <th style={{ padding: "11px 16px", textAlign: "center", width: 100 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollmentsLoading ? (
                        <tr><td colSpan={6} style={{ textAlign: "center", padding: 24 }}><Loader fullScreen={false} size="md" text="Loading students…" /></td></tr>
                      ) : filteredEnrollments.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontWeight: 700 }}>
                          {entrySearch ? "No students matching your search." : "No students enrolled in this class."}
                        </td></tr>
                      ) : (
                        filteredEnrollments.map((en, idx) => {
                          const m = marksMap[en.student_id] || { marks_obtained: "", is_absent: false, remarks: "" };
                          const score = parseFloat(m.marks_obtained);
                          const hasScore = !m.is_absent && m.marks_obtained !== "" && !isNaN(score);
                          const isPass = hasScore && selectedSchedule ? score >= selectedSchedule.pass_marks : false;

                          return (
                            <tr key={en.id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                              <td style={{ padding: "11px 16px", fontWeight: 800, color: "#64748b" }}>{en.roll_number ?? idx + 1}</td>
                              <td style={{ padding: "11px 16px" }}>
                                <div style={{ fontWeight: 800, color: "#0f172a" }}>{en.full_name}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{en.admission_number}</div>
                              </td>
                              <td style={{ padding: "11px 16px" }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={selectedSchedule?.max_marks ?? 100}
                                  value={m.marks_obtained}
                                  disabled={m.is_absent || isPublished}
                                  onChange={e => updateMark(en.student_id, "marks_obtained", e.target.value)}
                                  placeholder={m.is_absent ? "Absent" : `Max ${selectedSchedule?.max_marks ?? 100}`}
                                  style={{
                                    width: "100%", height: 36, padding: "0 10px", borderRadius: 8,
                                    border: `1.5px solid ${hasScore ? (isPass ? "#86efac" : "#fca5a5") : "#cbd5e1"}`,
                                    background: m.is_absent ? "#f1f5f9" : "#ffffff",
                                    fontWeight: 800, fontSize: 13.5, color: "#0f172a", outline: "none",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "11px 16px", textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={m.is_absent}
                                  disabled={isPublished}
                                  onChange={e => {
                                    updateMark(en.student_id, "is_absent", e.target.checked);
                                    if (e.target.checked) updateMark(en.student_id, "marks_obtained", "");
                                  }}
                                  style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#ff9148" }}
                                />
                              </td>
                              <td style={{ padding: "11px 16px" }}>
                                <input
                                  type="text"
                                  value={m.remarks}
                                  disabled={isPublished}
                                  onChange={e => updateMark(en.student_id, "remarks", e.target.value)}
                                  placeholder="Optional remarks"
                                  style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12.5, outline: "none" }}
                                />
                              </td>
                              <td style={{ padding: "11px 16px", textAlign: "center" }}>
                                {m.is_absent ? (
                                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, background: "#fef3c7", color: "#b45309" }}>Absent</span>
                                ) : hasScore ? (
                                  isPass ? (
                                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, background: "#dcfce7", color: "#15803d" }}>Pass</span>
                                  ) : (
                                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, background: "#fee2e2", color: "#b91c1c" }}>Fail</span>
                                  )
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card-Based Entry View */}
                <div className="mobile-card-list" style={{ padding: 10 }}>
                  {filteredEnrollments.map((en, idx) => {
                    const m = marksMap[en.student_id] || { marks_obtained: "", is_absent: false, remarks: "" };
                    const score = parseFloat(m.marks_obtained);
                    const hasScore = !m.is_absent && m.marks_obtained !== "" && !isNaN(score);
                    const isPass = hasScore && selectedSchedule ? score >= selectedSchedule.pass_marks : false;

                    return (
                      <div
                        key={en.id}
                        style={{
                          background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ padding: "2px 6px", borderRadius: 5, background: "#f1f5f9", fontWeight: 900, fontSize: 11.5, color: "#475569" }}>
                              #{en.roll_number ?? idx + 1}
                            </span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{en.full_name}</div>
                              <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{en.admission_number}</span>
                            </div>
                          </div>

                          {m.is_absent ? (
                            <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 900, background: "#fef3c7", color: "#b45309" }}>Absent</span>
                          ) : hasScore ? (
                            isPass ? (
                              <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 900, background: "#dcfce7", color: "#15803d" }}>Pass</span>
                            ) : (
                              <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 900, background: "#fee2e2", color: "#b91c1c" }}>Fail</span>
                            )
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 10.5 }}>Pending</span>
                          )}
                        </div>

                        {/* Marks & Absent Controls */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                          <div>
                            <input
                              type="number"
                              min={0}
                              max={selectedSchedule?.max_marks ?? 100}
                              value={m.marks_obtained}
                              disabled={m.is_absent || isPublished}
                              onChange={e => updateMark(en.student_id, "marks_obtained", e.target.value)}
                              placeholder={m.is_absent ? "Absent" : `Score (Max ${selectedSchedule?.max_marks ?? 100})`}
                              style={{
                                width: "100%", height: 36, padding: "0 10px", borderRadius: 7,
                                border: `1.5px solid ${hasScore ? (isPass ? "#86efac" : "#fca5a5") : "#cbd5e1"}`,
                                background: m.is_absent ? "#f1f5f9" : "#ffffff",
                                fontWeight: 800, fontSize: 13, color: "#0f172a", outline: "none",
                              }}
                            />
                          </div>

                          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={m.is_absent}
                              disabled={isPublished}
                              onChange={e => {
                                updateMark(en.student_id, "is_absent", e.target.checked);
                                if (e.target.checked) updateMark(en.student_id, "marks_obtained", "");
                              }}
                              style={{ width: 16, height: 16, accentColor: "#ff9148" }}
                            />
                            Absent
                          </label>
                        </div>

                        <input
                          type="text"
                          value={m.remarks}
                          disabled={isPublished}
                          onChange={e => updateMark(en.student_id, "remarks", e.target.value)}
                          placeholder="Optional remarks..."
                          style={{ width: "100%", height: 32, padding: "0 9px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 11.5, outline: "none" }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════════
              VIEW MODE 2: CLASS RESULT REGISTER / TABULATION SHEET (COORDINATOR ONLY)
             ══════════════════════════════════════════════════════════════════════════════ */}
          {viewMode === "register" && (
            <div className="printable-register" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Top Filter Bar (No Print) */}
              <div className="no-print register-filter-card">
                {/* Selectors & Search */}
                <div className="filter-controls-row">
                  
                  {/* Exam Dropdown */}
                  <div className="filter-select-group">
                    <i className="fa-solid fa-file-signature" style={{ color: "#ff9148", fontSize: 13 }} />
                    <div className="filter-select-inner">
                      <span className="filter-select-label">Exam</span>
                      <select
                        value={registerExamId}
                        onChange={e => setRegisterExamId(e.target.value)}
                        className="filter-select-input"
                      >
                        {(exams ?? []).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Coordinated Section Dropdown */}
                  <div className="filter-select-group">
                    <i className="fa-solid fa-users" style={{ color: "#ff9148", fontSize: 13 }} />
                    <div className="filter-select-inner">
                      <span className="filter-select-label">Section</span>
                      <select
                        value={registerSectionId}
                        onChange={e => setRegisterSectionId(e.target.value)}
                        className="filter-select-input"
                      >
                        {(coordinatedSections ?? []).map(sec => (
                          <option key={sec.id} value={sec.id}>
                            {sec.class_name} — Sec {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Search Student Input */}
                  <div className="filter-search-box">
                    <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 12 }} />
                    <input
                      type="text"
                      value={registerSearch}
                      onChange={e => setRegisterSearch(e.target.value)}
                      placeholder="Search student name or roll..."
                      className="filter-search-input"
                    />
                    {registerSearch && (
                      <button
                        type="button"
                        onClick={() => setRegisterSearch("")}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
                      >
                        <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
                      </button>
                    )}
                  </div>

                </div>

                {/* Sub-toolbar: Status Filter Chips & Sort Selector */}
                <div className="filter-sub-bar">
                  <div className="status-pill-list">
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginRight: 2, flexShrink: 0 }}>Status:</span>
                    {[
                      { key: "all",    label: "All",             count: registerData?.students?.length ?? 0 },
                      { key: "passed", label: "Passed",          count: registerData?.stats?.passed_count ?? 0 },
                      { key: "failed", label: "Needs Attention", count: registerData?.stats?.failed_count ?? 0 },
                    ].map(f => {
                      const isSel = registerStatusFilter === f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setRegisterStatusFilter(f.key as any)}
                          className={`status-pill ${isSel ? "active" : ""}`}
                        >
                          {f.label}
                          <span className="pill-badge">{f.count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sort By */}
                  <div className="sort-select-box">
                    <span style={{ flexShrink: 0 }}>Sort By:</span>
                    <select
                      value={registerSortBy}
                      onChange={e => setRegisterSortBy(e.target.value as any)}
                      className="sort-select-input"
                    >
                      <option value="rank">Rank (Default)</option>
                      <option value="roll">Roll Number</option>
                      <option value="name">Student Name (A-Z)</option>
                      <option value="percentage">Percentage (High to Low)</option>
                    </select>
                  </div>
                </div>
              </div>

              {registerLoading ? (
                <div style={{ padding: "3rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading mark register…" /></div>
              ) : !registerData ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontWeight: 700 }}>No register data available.</div>
              ) : (
                <>
                  {/* KPI Analytics Strip (No Print) */}
                  <div className="results-kpi-container no-print">
                    <div className="kpi-card">
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Total Students</span>
                      <div style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>
                        {registerData.stats.total_students}
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{registerData.stats.appeared_count} appeared</span>
                    </div>

                    <div className="kpi-card">
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Pass Rate</span>
                      <div style={{ fontSize: 19, fontWeight: 900, color: "#16a34a", marginTop: 2 }}>
                        {registerData.stats.pass_rate_pct}%
                      </div>
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>{registerData.stats.passed_count} of {registerData.stats.appeared_count} passed</span>
                    </div>

                    <div className="kpi-card">
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Class Average</span>
                      <div style={{ fontSize: 19, fontWeight: 900, color: "#3b82f6", marginTop: 2 }}>
                        {registerData.stats.class_avg_percentage}%
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Overall average</span>
                    </div>

                    <div className="kpi-card">
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Needs Attention</span>
                      <div style={{ fontSize: 19, fontWeight: 900, color: registerData.stats.failed_count > 0 ? "#dc2626" : "#16a34a", marginTop: 2 }}>
                        {registerData.stats.failed_count}
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>failing in 1+</span>
                    </div>

                    <div className="kpi-topper-cell">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 900, color: "#854d0e", textTransform: "uppercase" }}>👑 Section Topper</span>
                        {registerData.stats.topper && (
                          <span style={{ fontSize: 11, color: "#a16207", fontWeight: 800 }}>
                            {registerData.stats.topper.percentage}% ({registerData.stats.topper.total_obtained}/{registerData.stats.topper.total_max})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#854d0e", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {registerData.stats.topper ? registerData.stats.topper.student_name : "No scores entered"}
                      </div>
                    </div>
                  </div>

                  {/* ── Main Tabulation Sheet / Master Ledger Table ── */}
                  <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.03)" }}>
                    
                    {/* Sheet Header */}
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
                          {registerData.class_info?.class_name} {registerData.section_info ? `— Section ${registerData.section_info.section_name}` : ""} : {registerData.exam?.name}
                        </h2>
                        <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>
                          Section In-charge: <strong>{registerData.section_info?.coordinator_name || "You"}</strong> · {registerData.subjects?.length ?? 0} Scheduled Subjects
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {registerData.exam?.is_schedule_published ? (
                          <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 800, background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}>
                            Published
                          </span>
                        ) : (
                          <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 800, background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
                            Draft
                          </span>
                        )}

                        {/* View Switcher: Table vs Cards */}
                        <div style={{ display: "inline-flex", background: "#f1f5f9", padding: 2, borderRadius: 8, gap: 2 }}>
                          <button
                            type="button"
                            onClick={() => setRegisterViewMode("table")}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              background: registerViewMode === "table" ? "#ffffff" : "transparent",
                              color: registerViewMode === "table" ? "#0f172a" : "#64748b",
                              boxShadow: registerViewMode === "table" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                            }}
                          >
                            <i className="fa-solid fa-table" style={{ marginRight: 4 }} /> Table
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegisterViewMode("cards")}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              background: registerViewMode === "cards" ? "#ffffff" : "transparent",
                              color: registerViewMode === "cards" ? "#0f172a" : "#64748b",
                              boxShadow: registerViewMode === "cards" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                            }}
                          >
                            <i className="fa-solid fa-id-card" style={{ marginRight: 4 }} /> Cards
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Horizontal Scroll Hint for Mobile */}
                    {registerViewMode === "table" && (
                      <div className="mobile-scroll-cue">
                        <i className="fa-solid fa-arrows-left-right" /> Swipe horizontally to view full subject ledger
                      </div>
                    )}

                    {/* Table View */}
                    {registerViewMode === "table" && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #cbd5e1", color: "#475569", fontWeight: 900, fontSize: 11, textTransform: "uppercase" }}>
                              <th style={{ padding: "10px 12px", textAlign: "left", width: 50, position: "sticky", left: 0, background: "#f8fafc", zIndex: 2 }}>Roll</th>
                              <th style={{ padding: "10px 12px", textAlign: "left", minWidth: 140, position: "sticky", left: 50, background: "#f8fafc", zIndex: 2 }}>Student Name</th>
                              {registerData.subjects.map((sub: any) => (
                                <th key={sub.subject_id} style={{ padding: "10px 10px", textAlign: "center", minWidth: 90 }}>
                                  <div>{sub.subject_name}</div>
                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8" }}>Max: {sub.max_marks}</span>
                                </th>
                              ))}
                              <th style={{ padding: "10px 10px", textAlign: "center", minWidth: 80, background: "#f1f5f9" }}>Total</th>
                              <th style={{ padding: "10px 10px", textAlign: "center", minWidth: 70, background: "#f1f5f9" }}>%</th>
                              <th style={{ padding: "10px 10px", textAlign: "center", minWidth: 60, background: "#f1f5f9" }}>GPA</th>
                              <th style={{ padding: "10px 10px", textAlign: "center", minWidth: 75, background: "#f1f5f9" }}>Status</th>
                              <th style={{ padding: "10px 10px", textAlign: "center", minWidth: 90, background: "#f1f5f9" }}>Rank</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRegisterStudents.length === 0 ? (
                              <tr><td colSpan={registerData.subjects.length + 7} style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontWeight: 700 }}>
                                {registerSearch || registerStatusFilter !== "all" ? "No students matching your filter criteria." : "No enrolled students found in this section."}
                              </td></tr>
                            ) : (
                              filteredRegisterStudents.map((stu: any, idx: number) => (
                                <tr key={stu.student_id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                                  <td style={{ padding: "9px 12px", fontWeight: 800, color: "#64748b", position: "sticky", left: 0, background: idx % 2 === 0 ? "#ffffff" : "#fafbfc", zIndex: 1 }}>
                                    {stu.roll_number ?? idx + 1}
                                  </td>
                                  <td style={{ padding: "9px 12px", position: "sticky", left: 50, background: idx % 2 === 0 ? "#ffffff" : "#fafbfc", zIndex: 1 }}>
                                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{stu.full_name}</div>
                                    <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{stu.admission_number}</span>
                                  </td>

                                  {/* Marks per subject */}
                                  {registerData.subjects.map((sub: any) => {
                                    const markEntry = stu.marks[sub.subject_id];
                                    if (!markEntry) {
                                      return <td key={sub.subject_id} style={{ padding: "9px 10px", textAlign: "center", color: "#cbd5e1" }}>—</td>;
                                    }
                                    if (markEntry.is_absent) {
                                      return (
                                        <td key={sub.subject_id} style={{ padding: "9px 10px", textAlign: "center", background: "#fef3c7", color: "#b45309", fontWeight: 900, fontSize: 11 }}>
                                          ABS
                                        </td>
                                      );
                                    }
                                    const isFail = markEntry.marks_obtained !== null && !markEntry.is_passed;
                                    return (
                                      <td
                                        key={sub.subject_id}
                                        style={{
                                          padding: "9px 10px",
                                          textAlign: "center",
                                          fontWeight: 800,
                                          color: isFail ? "#dc2626" : "#0f172a",
                                          background: isFail ? "#fee2e2" : undefined,
                                        }}
                                      >
                                        {markEntry.marks_obtained ?? "—"}
                                        {markEntry.grade && <span style={{ fontSize: 9.5, color: isFail ? "#dc2626" : "#64748b", display: "block" }}>{markEntry.grade}</span>}
                                      </td>
                                    );
                                  })}

                                  {/* Total */}
                                  <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 900, color: "#0f172a", background: "#f8fafc" }}>
                                    {stu.has_marks ? stu.total_obtained : "—"}
                                  </td>

                                  {/* Percentage */}
                                  <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 900, color: "#0f172a", background: "#f8fafc" }}>
                                    {stu.overall_percentage !== null ? `${stu.overall_percentage}%` : "—"}
                                  </td>

                                  {/* GPA */}
                                  <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 800, color: "#3b82f6", background: "#f8fafc" }}>
                                    {stu.overall_gpa !== null ? stu.overall_gpa : "—"}
                                  </td>

                                  {/* Status */}
                                  <td style={{ padding: "9px 10px", textAlign: "center", background: "#f8fafc" }}>
                                    {stu.status === "passed" ? (
                                      <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 900, background: "#dcfce7", color: "#15803d" }}>Pass</span>
                                    ) : stu.status === "failed" ? (
                                      <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 900, background: "#fee2e2", color: "#b91c1c" }}>Fail ({stu.failed_subjects_count})</span>
                                    ) : (
                                      <span style={{ color: "#94a3b8", fontSize: 10.5 }}>Pending</span>
                                    )}
                                  </td>

                                  {/* Rank */}
                                  <td style={{ padding: "9px 10px", textAlign: "center", background: "#f8fafc" }}>
                                    {stu.is_topper ? (
                                      <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 900, background: "#fef08a", color: "#854d0e", border: "1px solid #facc15" }}>
                                        👑 #1
                                      </span>
                                    ) : stu.rank === 2 ? (
                                      <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 800, background: "#e2e8f0", color: "#334155" }}>
                                        🥈 #2
                                      </span>
                                    ) : stu.rank === 3 ? (
                                      <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 800, background: "#ffedd5", color: "#9a3412" }}>
                                        🥉 #3
                                      </span>
                                    ) : stu.rank ? (
                                      <span style={{ fontWeight: 800, color: "#64748b", fontSize: 11 }}>#{stu.rank}</span>
                                    ) : (
                                      <span style={{ color: "#cbd5e1" }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>

                          {/* Subject performance footer */}
                          {registerData.stats?.subject_stats && (
                            <tfoot>
                              <tr style={{ background: "#f1f5f9", borderTop: "2px solid #cbd5e1", fontWeight: 900, fontSize: 11, color: "#334155" }}>
                                <td colSpan={2} style={{ padding: "9px 12px", position: "sticky", left: 0, background: "#f1f5f9", zIndex: 1 }}>
                                  Subject Averages
                                </td>
                                {registerData.stats.subject_stats.map((stat: any) => (
                                  <td key={stat.subject_id} style={{ padding: "9px 10px", textAlign: "center" }}>
                                    <div>{stat.avg_marks !== null ? `${stat.avg_marks}` : "—"}</div>
                                    <span style={{ fontSize: 9.5, color: "#16a34a", fontWeight: 700 }}>{stat.pass_rate_pct}% pass</span>
                                  </td>
                                ))}
                                <td colSpan={5} style={{ background: "#f1f5f9" }}></td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    )}

                    {/* Card View (Touch & Mobile friendly) */}
                    {registerViewMode === "cards" && (
                      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {filteredRegisterStudents.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontWeight: 700 }}>
                            {registerSearch || registerStatusFilter !== "all" ? "No students matching your filter criteria." : "No enrolled students found in this section."}
                          </div>
                        ) : (
                          filteredRegisterStudents.map((stu: any, idx: number) => {
                            const isFail = stu.status === "failed";
                            return (
                              <div
                                key={stu.student_id}
                                style={{
                                  background: "#ffffff",
                                  borderRadius: 12,
                                  border: "1.5px solid #e2e8f0",
                                  padding: "12px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 10,
                                  boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
                                }}
                              >
                                {/* Header row: Roll, Name, Rank & Status */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: 7,
                                      background: "#f1f5f9",
                                      color: "#475569",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 900,
                                      fontSize: 12,
                                      flexShrink: 0,
                                    }}>
                                      #{stu.roll_number ?? idx + 1}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 900, fontSize: 13.5, color: "#0f172a" }}>{stu.full_name}</div>
                                      <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 600 }}>{stu.admission_number}</span>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                                    {stu.is_topper ? (
                                      <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 900, background: "#fef08a", color: "#854d0e", border: "1px solid #facc15" }}>
                                        👑 #1 Topper
                                      </span>
                                    ) : stu.rank ? (
                                      <span style={{ padding: "2px 6px", borderRadius: 5, fontSize: 10.5, fontWeight: 800, background: "#f1f5f9", color: "#475569" }}>
                                        Rank #{stu.rank}
                                      </span>
                                    ) : null}

                                    {stu.status === "passed" ? (
                                      <span style={{ padding: "2px 6px", borderRadius: 5, fontSize: 10, fontWeight: 900, background: "#dcfce7", color: "#15803d" }}>Pass</span>
                                    ) : stu.status === "failed" ? (
                                      <span style={{ padding: "2px 6px", borderRadius: 5, fontSize: 10, fontWeight: 900, background: "#fee2e2", color: "#b91c1c" }}>Fail ({stu.failed_subjects_count})</span>
                                    ) : (
                                      <span style={{ color: "#94a3b8", fontSize: 10 }}>Pending</span>
                                    )}
                                  </div>
                                </div>

                                {/* Quick Metrics Strip */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#f8fafc", borderRadius: 8, padding: "7px 10px", textAlign: "center", gap: 4 }}>
                                  <div>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Total</span>
                                    <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>{stu.has_marks ? stu.total_obtained : "—"}</div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Percentage</span>
                                    <div style={{ fontSize: 12.5, fontWeight: 900, color: isFail ? "#dc2626" : "#16a34a" }}>
                                      {stu.overall_percentage !== null ? `${stu.overall_percentage}%` : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>GPA</span>
                                    <div style={{ fontSize: 12.5, fontWeight: 900, color: "#3b82f6" }}>{stu.overall_gpa !== null ? stu.overall_gpa : "—"}</div>
                                  </div>
                                </div>

                                {/* Subject Scores Grid */}
                                <div>
                                  <span style={{ fontSize: 9.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Subject Breakdown</span>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 5 }}>
                                    {registerData.subjects.map((sub: any) => {
                                      const markEntry = stu.marks[sub.subject_id];
                                      const isSubFail = markEntry?.marks_obtained !== null && !markEntry?.is_passed;
                                      return (
                                        <div
                                          key={sub.subject_id}
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "5px 8px",
                                            borderRadius: 6,
                                            background: isSubFail ? "#fee2e2" : "#f8fafc",
                                            border: isSubFail ? "1px solid #fca5a5" : "1px solid #f1f5f9",
                                          }}
                                        >
                                          <span style={{ fontSize: 11, fontWeight: 700, color: isSubFail ? "#991b1b" : "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "65%" }}>
                                            {sub.subject_name}
                                          </span>
                                          <strong style={{ fontSize: 11.5, fontWeight: 900, color: isSubFail ? "#dc2626" : markEntry?.is_absent ? "#b45309" : "#0f172a" }}>
                                            {markEntry ? (markEntry.is_absent ? "ABS" : markEntry.marks_obtained) : "—"}
                                          </strong>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
