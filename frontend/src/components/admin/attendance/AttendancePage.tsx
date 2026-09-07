"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./attendance.module.css";
import { useApi } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { Spinner } from "@/components/shared/Loader";
import { Skeleton, SkeletonStatRow } from "@/components/shared/Skeleton";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const pctColor = (pct: number | null) => {
  if (pct === null) return "#94a3b8";
  if (pct >= 85) return "#16a34a";
  if (pct >= 70) return "#d97706";
  return "#dc2626";
};

/* ── Section Card Component ── */
function SectionCard({
  sec,
  curLabel,
  prevLabel,
}: {
  sec: any;
  curLabel: string;
  prevLabel: string;
}) {
  const students = Number(sec.total_students || 0);

  // Math for Current Month
  const curPresent = Number(sec.current_month_present || 0);
  const curWorking = Number(sec.current_working_days || 0);
  const curMax     = students * curWorking;
  const curPct     = curMax > 0 ? Math.min(100, Math.round((curPresent / curMax) * 100)) : null;
  const curAvg     = curWorking > 0 ? (curPresent / curWorking).toFixed(1) : "0";

  // Math for Prev Month
  const prevPresent = Number(sec.prev_month_present || 0);
  const prevWorking = Number(sec.prev_working_days || 0);
  const prevMax     = students * prevWorking;
  const prevPct     = prevMax > 0 ? Math.min(100, Math.round((prevPresent / prevMax) * 100)) : null;
  const prevAvg     = prevWorking > 0 ? (prevPresent / prevWorking).toFixed(1) : "0";

  const isMarkedToday = Boolean(sec.marked_today);

  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      border: "1.5px solid #e2e8f0",
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
      transition: "box-shadow 0.2s, border-color 0.2s",
    }}>
      {/* Top row: Section Name + Coordinator + Today's Status */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: "#eff6ff", border: "1px solid #bfdbfe",
            color: "#1e40af", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 16, fontWeight: 900,
          }}>
            {sec.section_name}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", margin: 0 }}>
                {sec.class_name} · Section {sec.section_name}
              </h3>
              <span style={{
                fontSize: 11, fontWeight: 800, color: "#475569",
                background: "#f1f5f9", padding: "1px 7px", borderRadius: 6,
              }}>
                {students} Student{students !== 1 ? "s" : ""}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="fa-solid fa-user-tie" style={{ color: "#FF9B51" }} />
              {sec.coordinator_name}
            </p>
          </div>
        </div>

        {/* Today's status badge */}
        <div>
          {isMarkedToday ? (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
              background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0",
              display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
            }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 10 }} />
              Marked Today
            </span>
          ) : (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
              background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa",
              display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
            }}>
              <i className="fa-solid fa-clock" style={{ fontSize: 10 }} />
              Pending Today
            </span>
          )}
        </div>
      </div>

      {/* Monthly Attendance Progress (Current vs Previous Month) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* Current Month */}
        <div style={{ padding: "10px 12px", borderRadius: 9, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.3px" }}>
              {curLabel}
            </span>
            <strong style={{ fontSize: 13, fontWeight: 900, color: pctColor(curPct) }}>
              {curPct !== null ? `${curPct}%` : "—"}
            </strong>
          </div>
          <div style={{ height: 5, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginBottom: 4 }}>
            <div style={{ height: "100%", width: `${curPct ?? 0}%`, background: pctColor(curPct), borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>
            {students > 0 && curWorking > 0 ? `Avg ${curAvg}/${students} daily` : `${curPresent} present days`}
          </div>
        </div>

        {/* Previous Month */}
        <div style={{ padding: "10px 12px", borderRadius: 9, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.3px" }}>
              {prevLabel}
            </span>
            <strong style={{ fontSize: 13, fontWeight: 900, color: pctColor(prevPct) }}>
              {prevPct !== null ? `${prevPct}%` : "—"}
            </strong>
          </div>
          <div style={{ height: 5, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginBottom: 4 }}>
            <div style={{ height: "100%", width: `${prevPct ?? 0}%`, background: pctColor(prevPct), borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>
            {students > 0 && prevWorking > 0 ? `Avg ${prevAvg}/${students} daily` : `${prevPresent} present days`}
          </div>
        </div>
      </div>

      {/* Footer: All-time & Quick Register Action */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2, borderTop: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>
          <i className="fa-solid fa-layer-group" style={{ marginRight: 5, color: "#3b82f6" }} />
          All-time: <strong style={{ color: "#0f172a" }}>{Number(sec.total_present_all_time || 0).toLocaleString()}</strong>
        </span>

        <Link
          href={`/attendance/class?class_id=${sec.class_id}&section_id=${sec.section_id}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 12px", borderRadius: 7, background: "#0f172a",
            color: "#fff", fontSize: 11.5, fontWeight: 800, textDecoration: "none",
          }}
        >
          <i className="fa-solid fa-clipboard-user" style={{ fontSize: 11 }} />
          View Register
        </Link>
      </div>
    </div>
  );
}

/* ── Main Attendance Overview Page ── */
export default function AttendancePage() {
  const { academicYearId } = useAcademicYear();
  const { formatMonth } = useDateFormat();

  const { data: summary, loading, error } = useApi<any>(
    academicYearId ? `/attendance/summary/admin?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );
  const { data: classes } = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  const [search, setSearch]             = useState("");
  const [classFilter, setClassFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const sections: any[] = summary?.sections ?? [];

  // Localized Month Labels (BS or AD)
  const curLabel = useMemo(() => {
    if (!summary?.current_month?.start) {
      const now = new Date();
      return formatMonth(now.getFullYear(), now.getMonth() + 1);
    }
    const [y, m] = summary.current_month.start.split("-").map(Number);
    return formatMonth(y, m);
  }, [summary, formatMonth]);

  const prevLabel = useMemo(() => {
    if (!summary?.prev_month?.start) {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return formatMonth(d.getFullYear(), d.getMonth() + 1);
    }
    const [y, m] = summary.prev_month.start.split("-").map(Number);
    return formatMonth(y, m);
  }, [summary, formatMonth]);

  // Aggregate Metrics for Top 4 Stat Cards
  const totalSections  = sections.length;
  const totalStudents  = sections.reduce((acc, s) => acc + Number(s.total_students || 0), 0);
  const markedTodayCnt = sections.filter(s => Boolean(s.marked_today)).length;
  const markedTodayPct = totalSections > 0 ? Math.round((markedTodayCnt / totalSections) * 100) : 0;

  const totalCurPresent = sections.reduce((acc, s) => acc + Number(s.current_month_present || 0), 0);
  const totalCurMax     = sections.reduce((acc, s) => acc + (Number(s.total_students || 0) * Number(s.current_working_days || 0)), 0);
  const curAvgRate      = totalCurMax > 0 ? Math.min(100, Math.round((totalCurPresent / totalCurMax) * 100)) : 0;

  // Filtered Sections
  const filtered = useMemo(() => {
    return sections.filter((sec) => {
      const q = search.toLowerCase();
      const matchSearch =
        sec.class_name?.toLowerCase().includes(q) ||
        sec.section_name?.toLowerCase().includes(q) ||
        sec.coordinator_name?.toLowerCase().includes(q);

      const matchClass =
        classFilter === "all" ||
        String(sec.class_id) === classFilter ||
        sec.class_name?.toLowerCase() === classFilter.toLowerCase();

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "marked" && sec.marked_today) ||
        (statusFilter === "pending" && !sec.marked_today);

      return matchSearch && matchClass && matchStatus;
    });
  }, [sections, search, classFilter, statusFilter]);

  // Group filtered sections by class_name
  const grouped: Record<string, any[]> = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((sec) => {
      if (!map[sec.class_name]) map[sec.class_name] = [];
      map[sec.class_name].push(sec);
    });
    return map;
  }, [filtered]);

  return (
    <div className={s("overviewPage")}>
      <main className={s("overviewContent")}>

        {/* ── Page Header ── */}
        <section className={s("pageHead")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-clipboard-user" />
            </div>
            <div>
              <h1>Class Attendance Overview</h1>
              <p>Section-wise attendance tracking, daily marking statuses, and monthly averages.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href="/attendance/class"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8, background: "#ff9b51",
                color: "#fff", fontSize: 13, fontWeight: 900, textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-list-check" /> Mark Attendance
            </Link>
          </div>
        </section>

        {/* ── 4 Compact Stat Cards (~75px) ── */}
        {loading && !summary ? (
          <div style={{ marginBottom: "1.5rem" }}>
            <SkeletonStatRow count={4} />
          </div>
        ) : (
          <section className={s("heroCards")}>
            <article className={cx(s("heroCard"), s("c1"))}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>Total Sections</span>
                <strong className={s("hcValue")}>{totalSections}</strong>
                <span className={s("hcSub")}>Active sections</span>
              </div>
              <div className={s("hcIcon")}><i className="fa-solid fa-table-cells" /></div>
            </article>

            <article className={cx(s("heroCard"), s("c2"))}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>Enrolled Students</span>
                <strong className={s("hcValue")}>{totalStudents}</strong>
                <span className={s("hcSub")}>Active academic year</span>
              </div>
              <div className={s("hcIcon")}><i className="fa-solid fa-user-graduate" /></div>
            </article>

            <article className={cx(s("heroCard"), s("c3"))}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>Today&apos;s Status</span>
                <strong className={s("hcValue")}>{markedTodayCnt} / {totalSections}</strong>
                <span className={s("hcSub")}>{markedTodayPct}% sections marked</span>
              </div>
              <div className={s("hcIcon")}><i className="fa-solid fa-circle-check" /></div>
            </article>

            <article className={cx(s("heroCard"), s("c4"))}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>{curLabel} Avg</span>
                <strong className={s("hcValue")}>{curAvgRate}%</strong>
                <span className={s("hcSub")}>Monthly overall rate</span>
              </div>
              <div className={s("hcIcon")}><i className="fa-solid fa-chart-line" /></div>
            </article>
          </section>
        )}

        {/* ── Filter & Search Toolbar ── */}
        <section className={s("filterBar")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
            <div className={s("searchField")}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8" }} />
              <input
                type="search"
                placeholder="Search class, section, teacher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                style={{
                  height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#0f172a", fontSize: 12.5, fontWeight: 700, outline: "none", cursor: "pointer",
                }}
              >
                <option value="all">All Classes</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#0f172a", fontSize: 12.5, fontWeight: 700, outline: "none", cursor: "pointer",
                }}
              >
                <option value="all">All Status</option>
                <option value="marked">Marked Today</option>
                <option value="unmarked">Not Marked Today</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#64748b" }}>
            Showing <strong>{filtered.length}</strong> section{filtered.length !== 1 ? "s" : ""}
          </div>
        </section>

        {/* ── Section Cards grouped by Class ── */}
        {loading && !summary ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <Skeleton width="50%" height={20} />
                  <Skeleton width="22%" height={20} borderRadius={10} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="100%" height={8} borderRadius={4} />
                  <Skeleton width="40%" height={12} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: "2.5rem", color: "#dc2626", textAlign: "center", fontWeight: 700 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0",
            padding: "4rem 2rem", textAlign: "center", color: "#64748b",
          }}>
            <i className="fa-solid fa-table-cells" style={{ fontSize: 36, opacity: 0.35, marginBottom: 12, display: "block" }} />
            <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a" }}>No sections match the selected filter</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Try clearing your search or selecting &quot;All Classes&quot;.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {Object.entries(grouped).map(([className, secs]) => (
              <div key={className}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "#ff9b51",
                    color: "#fff", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0,
                  }}>
                    <i className="fa-solid fa-school" />
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: 0 }}>{className}</h2>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                    {secs.length} section{secs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                  {secs.map((sec: any) => (
                    <SectionCard key={sec.section_id} sec={sec} curLabel={curLabel} prevLabel={prevLabel} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}

