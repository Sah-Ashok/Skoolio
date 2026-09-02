"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useAppSelector } from "@/store/hooks";

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  if (h === undefined || m === undefined) return t;
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function getSubjectIcon(name: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("math")) return "fa-calculator";
  if (n.includes("sci") || n.includes("phys") || n.includes("chem") || n.includes("bio")) return "fa-flask";
  if (n.includes("comp") || n.includes("tech") || n.includes("it") || n.includes("code")) return "fa-laptop-code";
  if (n.includes("eng") || n.includes("nep") || n.includes("lang") || n.includes("gram")) return "fa-language";
  if (n.includes("soc") || n.includes("hist") || n.includes("geo")) return "fa-earth-asia";
  if (n.includes("art") || n.includes("draw")) return "fa-palette";
  if (n.includes("music")) return "fa-music";
  return "fa-book-open";
}

function getDayName(isoDate: string) {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate.slice(0, 10) + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return "";
  }
}

function getRankInfo(item: any) {
  if (!item) return null;
  const {
    class_rank,
    total_students_in_class,
    section_rank,
    total_students_in_section,
    class_section_count,
    class_name,
    section_name,
  } = item;

  if (!class_rank) return null;

  const cRank = Number(class_rank);
  const sRank = Number(section_rank || 0);
  const hasMultipleSections = Number(class_section_count || 1) > 1;

  // Single section in this class -> Class rank ONLY (do not mention section)
  if (!hasMultipleSections) {
    if (cRank === 1) {
      return {
        isTopper: true,
        badgeType: "gold",
        title: "👑 Class Topper",
        subtitle: `Rank 1 of ${total_students_in_class || 1} in ${class_name || "Class"}`,
      };
    }
    if (cRank === 2) {
      return {
        isTopper: false,
        badgeType: "silver",
        title: "🥈 2nd Rank",
        subtitle: `Rank 2 of ${total_students_in_class || 2} in ${class_name || "Class"}`,
      };
    }
    if (cRank === 3) {
      return {
        isTopper: false,
        badgeType: "bronze",
        title: "🥉 3rd Rank",
        subtitle: `Rank 3 of ${total_students_in_class || 3} in ${class_name || "Class"}`,
      };
    }
    return {
      isTopper: false,
      badgeType: "default",
      title: `🎯 Rank #${cRank}`,
      subtitle: `Rank ${cRank} of ${total_students_in_class || cRank} in ${class_name || "Class"}`,
    };
  }

  // Multiple sections in this class -> Section & Class rank
  if (cRank === 1) {
    return {
      isTopper: true,
      badgeType: "gold",
      title: "👑 Overall Class Topper",
      subtitle: `Rank 1 of ${total_students_in_class} in ${class_name || "Class"} (Section ${section_name || ""} Topper)`,
    };
  }
  if (sRank === 1) {
    return {
      isTopper: true,
      badgeType: "gold",
      title: `🏆 Section ${section_name || ""} Topper`,
      subtitle: `Rank 1 of ${total_students_in_section} in Section ${section_name || ""} · Rank #${cRank} in ${class_name || "Class"}`,
    };
  }
  if (sRank === 2) {
    return {
      isTopper: false,
      badgeType: "silver",
      title: `🥈 2nd in Section ${section_name || ""}`,
      subtitle: `Rank 2 in Section ${section_name || ""} · Rank #${cRank} in ${class_name || "Class"}`,
    };
  }
  if (sRank === 3) {
    return {
      isTopper: false,
      badgeType: "bronze",
      title: `🥉 3rd in Section ${section_name || ""}`,
      subtitle: `Rank 3 in Section ${section_name || ""} · Rank #${cRank} in ${class_name || "Class"}`,
    };
  }
  return {
    isTopper: false,
    badgeType: "default",
    title: `🎯 Rank #${sRank} (Sec ${section_name || ""})`,
    subtitle: `Rank #${sRank} in Section ${section_name || ""} · Rank #${cRank} in ${class_name || "Class"}`,
  };
}

export default function StudentResultsPage() {
  const [activeTab, setActiveTab] = useState<"schedule" | "results">("schedule");
  const { formatDate } = useDateFormat();

  const activeYear     = useAppSelector(s => s.academicYear?.activeYear);
  const academicYearId = activeYear?.id ?? null;

  const { data: schedules, loading: schedulesLoading } = useApi<any[]>(
    academicYearId ? `/exams/me/schedules?academic_year_id=${academicYearId}` : "/exams/me/schedules"
  );

  const { data: results, loading: resultsLoading } = useApi<any[]>(
    academicYearId ? `/exams/me/results?academic_year_id=${academicYearId}` : "/exams/me/results"
  );

  const loading = activeTab === "schedule" ? schedulesLoading : resultsLoading;

  // Group schedules by exam_name
  const groupedSchedules = (schedules || []).reduce((acc: Record<string, any[]>, s: any) => {
    const key = s.exam_name || `Exam ${s.exam_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  // Group results by exam_name
  const groupedResults = (results || []).reduce((acc: Record<string, any[]>, r: any) => {
    const key = r.exam_name || `Exam ${r.exam_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const scheduleCount = schedules?.length ?? 0;
  const resultCount   = results?.length ?? 0;

  return (
    <>
      <style>{`
        .srp-page {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Nunito', 'Inter', sans-serif;
        }

        .srp-content {
          padding: 24px 28px 48px;
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── Page head ── */
        .srp-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .srp-head h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.3px;
        }
        .srp-head p {
          margin: 4px 0 0;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
        }

        .srp-year-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          border-radius: 9px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          font-size: 12px;
          font-weight: 800;
          color: #0369a1;
        }

        /* ── Segmented tab controls ── */
        .srp-tabs {
          display: inline-flex;
          background: #ffffff;
          padding: 4px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
          gap: 4px;
          width: fit-content;
        }

        .srp-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 9px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 800;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .srp-tab-btn:hover:not(.active) {
          color: #0f172a;
          background: #f8fafc;
        }

        .srp-tab-btn.active {
          background: #ff9148;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(255, 145, 72, 0.25);
        }

        .srp-tab-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 7px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 900;
          background: rgba(0, 0, 0, 0.08);
          color: inherit;
        }
        .srp-tab-btn.active .srp-tab-pill {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
        }

        /* ── Exam card container ── */
        .srp-exam-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.03), 0 4px 16px rgba(15, 23, 42, 0.02);
          overflow: hidden;
          margin-bottom: 20px;
        }

        .srp-exam-head {
          padding: 16px 20px;
          background: #ffffff;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .srp-exam-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .srp-exam-name {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.2px;
        }

        .srp-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          text-transform: capitalize;
        }
        .srp-pill-type {
          background: #fff7ed;
          color: #ea580c;
          border: 1px solid #fed7aa;
        }
        .srp-pill-count {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        /* ── Rank badges ── */
        .srp-rank-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: -0.2px;
        }
        .srp-rank-gold {
          background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%);
          color: #854d0e;
          border: 1.5px solid #facc15;
          box-shadow: 0 2px 6px rgba(234, 179, 8, 0.2);
        }
        .srp-rank-silver {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          color: #334155;
          border: 1.5px solid #cbd5e1;
        }
        .srp-rank-bronze {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          color: #9a3412;
          border: 1.5px solid #fdba74;
        }
        .srp-rank-default {
          background: #f0fdf4;
          color: #166534;
          border: 1.5px solid #bbf7d0;
        }

        /* ── Stat summary strip inside exam result card ── */
        .srp-summary-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          padding: 14px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .srp-stat-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .srp-stat-label {
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .srp-stat-val {
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .srp-exam-dates {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        /* ── Schedule routine list ── */
        .srp-schedule-list {
          padding: 16px 20px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 14px;
        }

        .srp-schedule-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: relative;
          transition: all 0.15s ease;
        }
        .srp-schedule-card:hover {
          background: #ffffff;
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
          transform: translateY(-1px);
        }

        .srp-sch-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .srp-subject-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .srp-subject-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #ff9148;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          flex-shrink: 0;
        }

        .srp-subject-name {
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: capitalize;
        }

        .srp-sch-date-pill {
          background: #e2f6ee;
          color: #059669;
          border: 1px solid #bbf7d0;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 800;
          white-space: nowrap;
        }

        .srp-sch-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding-top: 6px;
          border-top: 1px dashed #e2e8f0;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }

        .srp-sch-detail-item {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        .srp-sch-detail-item i {
          color: #94a3b8;
          font-size: 12px;
        }

        /* ── Results table ── */
        .srp-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .srp-table {
          width: 100%;
          border-collapse: collapse;
        }

        .srp-table th {
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 18px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          white-space: nowrap;
        }

        .srp-table td {
          padding: 13px 18px;
          font-size: 13px;
          color: #0f172a;
          border-bottom: 1px solid #f1f5f9;
          font-weight: 600;
          vertical-align: middle;
        }
        .srp-table tbody tr:last-child td {
          border-bottom: none;
        }
        .srp-table tbody tr:hover {
          background: #fafbfc;
        }

        .srp-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
        }
        .srp-badge-pass { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .srp-badge-fail { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        .srp-badge-absent { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

        /* ── Empty state ── */
        .srp-empty {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 48px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .srp-empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: #f1f5f9;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }
        .srp-empty h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: #1e293b;
        }
        .srp-empty p {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          max-width: 320px;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .srp-content { padding: 16px 14px 40px; gap: 16px; }
          .srp-head { flex-direction: column; align-items: flex-start; gap: 12px; }
          .srp-tabs { width: 100%; }
          .srp-tab-btn { flex: 1; justify-content: center; padding: 8px 12px; font-size: 12.5px; }
          .srp-schedule-list { grid-template-columns: 1fr; padding: 12px 14px; gap: 10px; }
          .srp-exam-head { padding: 14px 16px; }
          .srp-summary-strip { grid-template-columns: 1fr 1fr; padding: 12px 14px; gap: 10px; }
        }
      `}</style>

      <div className="srp-page">
        <main className="srp-content">
          
          {/* ── Header ── */}
          <section className="srp-head">
            <div>
              <h1>Exams & Routine</h1>
              <p>View your upcoming examination schedules, routine, and published report cards.</p>
            </div>
            {activeYear && (
              <div className="srp-year-badge">
                <i className="fa-solid fa-calendar-check" />
                <span>Academic Year: <strong>{activeYear.year_name}</strong></span>
              </div>
            )}
          </section>

          {/* ── Segmented Tab Switcher ── */}
          <div className="srp-tabs">
            <button
              type="button"
              className={`srp-tab-btn${activeTab === "schedule" ? " active" : ""}`}
              onClick={() => setActiveTab("schedule")}
            >
              <i className="fa-solid fa-calendar-days" />
              <span>Exam Schedule</span>
              {scheduleCount > 0 && <span className="srp-tab-pill">{scheduleCount}</span>}
            </button>
            <button
              type="button"
              className={`srp-tab-btn${activeTab === "results" ? " active" : ""}`}
              onClick={() => setActiveTab("results")}
            >
              <i className="fa-solid fa-chart-simple" />
              <span>Published Results</span>
              {resultCount > 0 && <span className="srp-tab-pill">{resultCount}</span>}
            </button>
          </div>

          {/* ── Content View ── */}
          {loading ? (
            <div style={{ padding: "4rem", textAlign: "center" }}>
              <Spinner size={32} color="#ff9148" />
            </div>
          ) : activeTab === "schedule" ? (
            /* ── TAB 1: EXAM SCHEDULES ── */
            Object.keys(groupedSchedules).length === 0 ? (
              <div className="srp-empty">
                <div className="srp-empty-icon">
                  <i className="fa-solid fa-calendar-xmark" />
                </div>
                <h3>No Exam Routine Published</h3>
                <p>There are no exam schedules posted for your class yet. Check back closer to exam dates.</p>
              </div>
            ) : (
              Object.entries(groupedSchedules).map(([examName, items]) => {
                const first = items[0];
                const examType = first?.exam_type?.replace("_", " ") || "Examination";
                const startDate = first?.exam_start_date ? formatDate(first.exam_start_date) : "";
                const endDate   = first?.exam_end_date   ? formatDate(first.exam_end_date)   : "";

                return (
                  <div className="srp-exam-card" key={examName}>
                    <div className="srp-exam-head">
                      <div className="srp-exam-title-group">
                        <h2 className="srp-exam-name">{examName}</h2>
                        <span className="srp-pill srp-pill-type">{examType}</span>
                        <span className="srp-pill srp-pill-count">{items.length} Papers</span>
                      </div>
                      {(startDate || endDate) && (
                        <div className="srp-exam-dates">
                          <i className="fa-solid fa-calendar-week" style={{ color: "#ff9148" }} />
                          <span>{startDate} {endDate ? `— ${endDate}` : ""}</span>
                        </div>
                      )}
                    </div>

                    <div className="srp-schedule-list">
                      {items.map((sch: any) => {
                        const dayName = getDayName(sch.exam_date);
                        return (
                          <div className="srp-schedule-card" key={sch.id}>
                            <div className="srp-sch-top">
                              <div className="srp-subject-info">
                                <div className="srp-subject-icon">
                                  <i className={`fa-solid ${getSubjectIcon(sch.subject_name)}`} />
                                </div>
                                <span className="srp-subject-name">{sch.subject_name}</span>
                              </div>
                              <span className="srp-sch-date-pill">
                                {formatDate(sch.exam_date)} {dayName ? `(${dayName})` : ""}
                              </span>
                            </div>

                            <div className="srp-sch-details">
                              <div className="srp-sch-detail-item">
                                <i className="fa-regular fa-clock" />
                                <span>{formatTime(sch.start_time)} – {formatTime(sch.end_time)}</span>
                              </div>
                              <div className="srp-sch-detail-item">
                                <i className="fa-solid fa-location-dot" />
                                <span>{sch.venue || "Classroom"}</span>
                              </div>
                              <div className="srp-sch-detail-item">
                                <i className="fa-solid fa-award" />
                                <span>Max: {sch.max_marks} marks</span>
                              </div>
                              <div className="srp-sch-detail-item">
                                <i className="fa-solid fa-circle-check" />
                                <span>Pass: {sch.pass_marks} marks</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* ── TAB 2: EXAM RESULTS ── */
            Object.keys(groupedResults).length === 0 ? (
              <div className="srp-empty">
                <div className="srp-empty-icon">
                  <i className="fa-solid fa-file-circle-xmark" />
                </div>
                <h3>No Published Results Yet</h3>
                <p>Exam results have not been published for this academic year yet.</p>
              </div>
            ) : (
              Object.entries(groupedResults).map(([examName, subjectResults]) => {
                const firstResult = subjectResults[0];
                const rankInfo = getRankInfo(firstResult);

                const totalMax = subjectResults.reduce((sum, r) => sum + Number(r.max_marks || 0), 0);
                const totalObtained = subjectResults.reduce((sum, r) => sum + Number(r.marks_obtained || 0), 0);
                const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
                const failCount = subjectResults.filter((r: any) => !r.is_passed && !r.is_absent).length;
                const absentCount = subjectResults.filter((r: any) => r.is_absent).length;

                return (
                  <div className="srp-exam-card" key={examName}>
                    <div className="srp-exam-head">
                      <div className="srp-exam-title-group">
                        <h2 className="srp-exam-name">{examName}</h2>
                        <span className="srp-pill srp-pill-count">{subjectResults.length} Subjects</span>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {rankInfo && (
                          <span className={`srp-rank-pill srp-rank-${rankInfo.badgeType}`}>
                            {rankInfo.title}
                          </span>
                        )}
                        <span className="srp-pill" style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe", fontSize: 12 }}>
                          {overallPct}% Overall Score
                        </span>
                      </div>
                    </div>

                    {/* ── Summary Stat Strip ── */}
                    <div className="srp-summary-strip">
                      <div className="srp-stat-item">
                        <span className="srp-stat-label">Total Marks</span>
                        <span className="srp-stat-val">
                          <i className="fa-solid fa-calculator" style={{ color: "#ff9148", fontSize: 13 }} />
                          {totalObtained.toFixed(1)} / {totalMax}
                        </span>
                      </div>

                      <div className="srp-stat-item">
                        <span className="srp-stat-label">Overall Percentage</span>
                        <span className="srp-stat-val">
                          <i className="fa-solid fa-percent" style={{ color: "#3b82f6", fontSize: 13 }} />
                          {overallPct}%
                        </span>
                      </div>

                      {rankInfo && (
                        <div className="srp-stat-item">
                          <span className="srp-stat-label">Class Position / Rank</span>
                          <span className="srp-stat-val" style={{ color: rankInfo.isTopper ? "#b45309" : "#0f172a" }}>
                            {rankInfo.subtitle}
                          </span>
                        </div>
                      )}

                      <div className="srp-stat-item">
                        <span className="srp-stat-label">Overall Result</span>
                        <span className="srp-stat-val">
                          {absentCount > 0 ? (
                            <span style={{ color: "#b45309", display: "flex", alignItems: "center", gap: 5 }}>
                              <i className="fa-solid fa-triangle-exclamation" /> Absent ({absentCount})
                            </span>
                          ) : failCount > 0 ? (
                            <span style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: 5 }}>
                              <i className="fa-solid fa-circle-xmark" /> Failed ({failCount} subject{failCount > 1 ? "s" : ""})
                            </span>
                          ) : (
                            <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 5 }}>
                              <i className="fa-solid fa-circle-check" /> Passed All Subjects ✓
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="srp-table-wrap">
                      <table className="srp-table">
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Marks Obtained</th>
                            <th>Max Marks</th>
                            <th>Percentage</th>
                            <th>Grade</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectResults.map((r: any) => (
                            <tr key={r.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <i className={`fa-solid ${getSubjectIcon(r.subject_name)}`} style={{ color: "#ff9148", fontSize: 13 }} />
                                  <strong style={{ textTransform: "capitalize" }}>{r.subject_name}</strong>
                                </div>
                              </td>
                              <td style={{ fontWeight: 800 }}>{r.is_absent ? "Absent" : r.marks_obtained}</td>
                              <td>{r.max_marks}</td>
                              <td>{r.is_absent ? "—" : `${r.percentage}%`}</td>
                              <td>{r.is_absent ? "—" : (r.grade || "—")}</td>
                              <td>
                                {r.is_absent ? (
                                  <span className="srp-badge srp-badge-absent">Absent</span>
                                ) : r.is_passed ? (
                                  <span className="srp-badge srp-badge-pass">Pass</span>
                                ) : (
                                  <span className="srp-badge srp-badge-fail">Fail</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )
          )}
        </main>
      </div>
    </>
  );
}
